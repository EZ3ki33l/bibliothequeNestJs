// Spec 020 : moteur de synthèse vocale, dans un worker pour ne jamais figer la page.
//
// Rôle : télécharger (une fois, puis lire en cache) le runtime ONNX et le modèle
// de voix, phonémiser chaque segment de texte avec le programme séparé
// frontend/phonemizer/ (GPL-3), faire tourner le modèle et renvoyer du son.
//
// Il ne contacte QUE les fichiers du site (/piper/…). Aucun texte, aucune voix
// choisie ni aucune position ne sort d'ici (contrat : engine-protocol.md).
import * as ort from 'onnxruntime-web/wasm';
import { AUDIO_CACHE_NAME, AUDIO_MANIFEST, type ManifestFile } from '../lib/audioManifest';
import type {
  EngineErrorCode,
  EngineRequest,
  EngineResponse,
  PhonemizerRequest,
  PhonemizerResponse,
} from '../lib/audioProtocol';
import { VOICE_MODEL_ID } from '../lib/audioVoices';

/** Le worker espeak-ng cesse de répondre après ~100 appels (spike) : on le recrée avant. */
const PHONEMIZER_RECYCLE_EVERY = 50;
const PHONEMIZER_TIMEOUT_MS = 5000;

class EngineError extends Error {
  code: EngineErrorCode;
  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function send(message: EngineResponse, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer });
}

// --- Fichiers : réseau, progression, Cache Storage ------------------------------------------

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(AUDIO_CACHE_NAME);
  } catch {
    return null; // navigation privée, stockage bloqué : tout repasse par le réseau
  }
}

/** Retire du cache les fichiers d'une ancienne version du moteur. */
async function pruneCache(cache: Cache, known: Set<string>): Promise<void> {
  for (const request of await cache.keys()) {
    if (!known.has(new URL(request.url).pathname)) await cache.delete(request);
  }
}

/** Lit un fichier du site en flux et compte les octets reçus. Taille exacte exigée. */
async function fetchBytes(
  file: ManifestFile,
  onBytes: (count: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new Uint8Array(file.size);
  let received = 0;
  try {
    const response = await fetch(file.url, { credentials: 'omit' });
    if (!response.ok || response.body === null) {
      throw new EngineError('network', `Réponse ${response.status} pour ${file.url}`);
    }
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (received + value.length > file.size) {
        throw new EngineError('network', `Fichier plus grand que prévu : ${file.url}`);
      }
      bytes.set(value, received);
      received += value.length;
      onBytes(value.length);
    }
  } catch (error) {
    if (error instanceof EngineError) throw error;
    throw new EngineError('network', `Téléchargement interrompu : ${file.url}`);
  }
  if (received !== file.size) {
    throw new EngineError('network', `Fichier incomplet (${received}/${file.size}) : ${file.url}`);
  }
  return bytes;
}

/**
 * Cache d'abord, réseau sinon, puis mise en cache. `keep: false` pour les fichiers que
 * le phonémiseur récupère lui-même : on les télécharge pour la progression et pour
 * chauffer le cache HTTP, sans garder leurs octets.
 * shortcut: le phonémiseur relit ses fichiers par le cache HTTP du navigateur, pas par
 * Cache Storage ; évincés, ils se retéléchargent sans progression (≈ 10 Mo), à corriger
 * en lui passant des adresses blob: si cela gêne.
 */
async function loadFile(
  file: ManifestFile,
  cache: Cache | null,
  onBytes: (count: number) => void,
  keep: true,
): Promise<Uint8Array<ArrayBuffer>>;
async function loadFile(
  file: ManifestFile,
  cache: Cache | null,
  onBytes: (count: number) => void,
  keep: false,
): Promise<null>;
async function loadFile(
  file: ManifestFile,
  cache: Cache | null,
  onBytes: (count: number) => void,
  keep: boolean,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const hit = await cache?.match(file.url);
  if (hit) {
    if (!keep) return null;
    const cached = new Uint8Array(await hit.arrayBuffer());
    if (cached.length === file.size) return cached;
    await cache?.delete(file.url); // entrée tronquée ou périmée : on la refait
  }
  const bytes = await fetchBytes(file, onBytes);
  try {
    await cache?.put(file.url, new Response(bytes));
  } catch {
    // Quota plein : l'écoute marche, le fichier sera retéléchargé la prochaine fois.
  }
  return keep ? bytes : null;
}

// --- Phonémiseur (programme séparé), recyclé tous les N appels -------------------------------

let phonemizer: Worker | null = null;
let phonemizerCalls = 0;
let phonemizerSeq = 0;
const phonemizerPending = new Map<
  number,
  { resolve: (ids: number[]) => void; reject: (error: Error) => void }
>();

function stopPhonemizer(reason: string): void {
  phonemizer?.terminate();
  phonemizer = null;
  phonemizerCalls = 0;
  for (const pending of phonemizerPending.values()) pending.reject(new Error(reason));
  phonemizerPending.clear();
}

function ensurePhonemizer(): Worker {
  if (phonemizer !== null && phonemizerCalls < PHONEMIZER_RECYCLE_EVERY) return phonemizer;
  stopPhonemizer('phonémiseur recyclé');
  const worker = new Worker(`${AUDIO_MANIFEST.base}phonemizer/worker.js`);
  worker.onmessage = (event: MessageEvent<PhonemizerResponse>) => {
    const pending = phonemizerPending.get(event.data.id);
    if (pending === undefined) return;
    phonemizerPending.delete(event.data.id);
    if (event.data.type === 'phonemeIds') pending.resolve(event.data.phonemeIds);
    else pending.reject(new Error(event.data.message));
  };
  worker.onerror = () => stopPhonemizer('phonémiseur en erreur');
  phonemizer = worker;
  return worker;
}

function phonemizeOnce(text: string): Promise<number[]> {
  const worker = ensurePhonemizer();
  phonemizerCalls += 1;
  const id = (phonemizerSeq += 1);
  return new Promise<number[]>((resolve, reject) => {
    // Un appel sans réponse (le worker espeak-ng peut se figer) est un échec, pas une attente infinie.
    const timer = setTimeout(() => {
      phonemizerPending.delete(id);
      reject(new Error('phonémiseur sans réponse'));
    }, PHONEMIZER_TIMEOUT_MS);
    phonemizerPending.set(id, {
      resolve: (ids) => {
        clearTimeout(timer);
        resolve(ids);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    const request: PhonemizerRequest = { type: 'phonemize', id, text, voice: 'fr' };
    worker.postMessage(request);
  });
}

/** Un échec recrée le worker et rejoue l'appel une fois ; au second, l'échec remonte. */
async function phonemize(text: string): Promise<number[]> {
  try {
    return await phonemizeOnce(text);
  } catch {
    stopPhonemizer('phonémiseur recréé après un échec');
    return phonemizeOnce(text);
  }
}

// --- Chargement : moteur ONNX + modèle de voix ----------------------------------------------

type LoadedVoice = {
  session: ort.InferenceSession;
  sampleRate: number;
  /** [noise_scale, length_scale, noise_w] : les réglages d'origine du modèle. */
  scales: [number, number, number];
};

let loaded: LoadedVoice | null = null;
let loading: Promise<LoadedVoice> | null = null;
let engineBlobUrl: string | null = null;

function parseVoiceConfig(bytes: Uint8Array): Pick<LoadedVoice, 'sampleRate' | 'scales'> {
  const config = JSON.parse(new TextDecoder().decode(bytes)) as {
    audio?: { sample_rate?: unknown };
    inference?: { noise_scale?: unknown; length_scale?: unknown; noise_w?: unknown };
  };
  const { sample_rate } = config.audio ?? {};
  const { noise_scale, length_scale, noise_w } = config.inference ?? {};
  if (
    typeof sample_rate !== 'number' ||
    typeof noise_scale !== 'number' ||
    typeof length_scale !== 'number' ||
    typeof noise_w !== 'number'
  ) {
    throw new EngineError('synthesis', 'Configuration de voix invalide');
  }
  return { sampleRate: sample_rate, scales: [noise_scale, length_scale, noise_w] };
}

async function doLoad(): Promise<LoadedVoice> {
  if (typeof WebAssembly === 'undefined' || typeof Worker === 'undefined') {
    throw new EngineError('unsupported', 'WebAssembly ou les workers ne sont pas disponibles');
  }
  const model = AUDIO_MANIFEST.voices[VOICE_MODEL_ID];
  const modelFile = model?.files.find((file) => file.url.endsWith('/model.onnx'));
  const configFile = model?.files.find((file) => file.url.endsWith('/model.onnx.json'));
  const wasmFile = AUDIO_MANIFEST.engine.find((file) => file.url.endsWith('.wasm'));
  const mjsFile = AUDIO_MANIFEST.engine.find((file) => file.url.endsWith('.mjs'));
  if (!modelFile || !configFile || !wasmFile || !mjsFile) {
    throw new EngineError('synthesis', 'Liste des fichiers de voix incomplète');
  }

  const everything = [...AUDIO_MANIFEST.engine, ...AUDIO_MANIFEST.phonemizer, ...model.files];
  const cache = await openCache();
  if (cache) await pruneCache(cache, new Set(everything.map((file) => file.url)));

  // La progression ne compte que ce qui vient du réseau : tout en cache, aucun message.
  const missing: ManifestFile[] = [];
  for (const file of everything) {
    if (!(await cache?.match(file.url))) missing.push(file);
  }
  const total = missing.reduce((sum, file) => sum + file.size, 0);
  let received = 0;
  let sentAt = 0;
  const onBytes = (count: number) => {
    received += count;
    if (received - sentAt >= total / 200 || received === total) {
      sentAt = received;
      send({ type: 'progress', loaded: received, total });
    }
  };
  if (total > 0) send({ type: 'progress', loaded: 0, total });

  const wasm = await loadFile(wasmFile, cache, onBytes, true);
  const mjs = await loadFile(mjsFile, cache, onBytes, true);
  for (const file of AUDIO_MANIFEST.phonemizer) await loadFile(file, cache, onBytes, false);
  const config = parseVoiceConfig(await loadFile(configFile, cache, onBytes, true));
  const modelBytes = await loadFile(modelFile, cache, onBytes, true);

  // Le runtime reçoit ses octets d'ici : il ne va rien chercher lui-même.
  ort.env.logLevel = 'error';
  ort.env.wasm.numThreads = 1; // plusieurs fils exigeraient COOP/COEP sur tout le site
  ort.env.wasm.wasmBinary = wasm;
  engineBlobUrl = URL.createObjectURL(new Blob([mjs], { type: 'text/javascript' }));
  ort.env.wasm.wasmPaths = { mjs: engineBlobUrl };

  try {
    const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'] });
    return { session, ...config };
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    const memory = error instanceof RangeError || /memory|alloc|oom/i.test(message);
    throw new EngineError(memory ? 'memory' : 'synthesis', message.slice(0, 200));
  }
}

function ensureLoaded(): Promise<LoadedVoice> {
  if (loaded !== null) return Promise.resolve(loaded);
  loading ??= doLoad()
    .then((voice) => (loaded = voice))
    .finally(() => {
      loading = null;
    });
  return loading;
}

// --- Synthèse : une demande à la fois -------------------------------------------------------

let queue: Promise<void> = Promise.resolve();
/** « Tout annuler » incrémente : les demandes plus anciennes sont jetées. */
let generation = 0;
const cancelled = new Set<number>();

function isCancelled(requestId: number, since: number): boolean {
  return since !== generation || cancelled.delete(requestId);
}

async function synthesize(
  requestId: number,
  text: string,
  speakerId: number,
  since: number,
): Promise<void> {
  if (isCancelled(requestId, since)) return;
  const voice = await ensureLoaded();
  const ids = await phonemize(text);
  if (isCancelled(requestId, since)) return;

  const [noiseScale, lengthScale, noiseW] = voice.scales;
  const output = await voice.session.run({
    input: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.of(BigInt(ids.length)), [1]),
    scales: new ort.Tensor('float32', Float32Array.of(noiseScale, lengthScale, noiseW), [3]),
    sid: new ort.Tensor('int64', BigInt64Array.of(BigInt(speakerId)), [1]),
  });
  // Copie : on transfère un tampon qui nous appartient, pas celui du runtime.
  const pcm = new Float32Array(output.output.data as Float32Array);
  if (isCancelled(requestId, since)) return;
  send({ type: 'audio', requestId, pcm, sampleRate: voice.sampleRate }, [pcm.buffer]);
}

function report(error: unknown, requestId?: number): void {
  const code: EngineErrorCode = error instanceof EngineError ? error.code : 'synthesis';
  const message = String((error as Error)?.message ?? error).slice(0, 200);
  send({ type: 'failed', requestId, code, message });
}

// --- Messages de la page ---------------------------------------------------------------------

self.addEventListener('message', (event: MessageEvent<EngineRequest>) => {
  const request = event.data;
  switch (request?.type) {
    case 'load':
      ensureLoaded()
        .then((voice) => send({ type: 'ready', sampleRate: voice.sampleRate }))
        .catch((error: unknown) => report(error));
      break;
    case 'synthesize': {
      const { requestId, text, speakerId } = request;
      if (typeof text !== 'string' || text === '' || !Number.isInteger(speakerId)) {
        report(new EngineError('synthesis', 'Demande invalide'), requestId);
        break;
      }
      const since = generation;
      queue = queue
        .then(() => synthesize(requestId, text, speakerId, since))
        .catch((error: unknown) => report(error, requestId));
      break;
    }
    case 'cancel':
      if (request.requestId === 'all') generation += 1;
      else cancelled.add(request.requestId);
      break;
    case 'dispose':
      generation += 1;
      stopPhonemizer('moteur libéré');
      void loaded?.session.release();
      loaded = null;
      if (engineBlobUrl !== null) URL.revokeObjectURL(engineBlobUrl);
      engineBlobUrl = null;
      break;
  }
});
