// Spec 020 : le contrôleur de lecture. Pas de React ici : il orchestre le worker du
// moteur, la file de segments et UN élément <audio>, et prévient l'interface par
// des rappels. Le hook `useEntryAudio` n'est qu'un branchement dessus.
//
// Déroulement : « Écouter » → on collecte le texte de la page → un worker est créé
// (une seule fois, c'est ce clic qui déclenche tout téléchargement) → chaque
// segment est synthétisé en avance (deux d'avance) pendant que le précédent se
// joue → fin du corps : « terminé ».
import { collectSections, type AudioSection } from './audioSections';
import type { EngineErrorCode, EngineRequest, EngineResponse } from './audioProtocol';
import { pcmToWavBlob } from './audioWav';

export type AudioStatus =
  'idle' | 'downloading' | 'preparing' | 'playing' | 'paused' | 'ended' | 'error';

export type AudioFailure = { code: EngineErrorCode | 'empty'; message: string };
export type AudioProgress = { loaded: number; total: number };

export type ControllerEvents = {
  status(status: AudioStatus): void;
  failure(failure: AudioFailure | null): void;
  progress(progress: AudioProgress | null): void;
  /** Section lue (`null` à l'arrêt) et nombre total de sections. */
  section(index: number | null, count: number): void;
};

type Segment = { sectionIndex: number; text: string };
type Synthesized = { wav: Blob };

/** Segments préparés avant celui qui se joue. */
const LOOKAHEAD = 2;
/** « Section précédente » revient au début de la section en cours si elle est entamée depuis plus que ceci. */
const RESTART_AFTER_SECONDS = 3;
/** Le contenu d'une fiche s'affiche en deux temps (coloration du code) : on attend au plus ceci. */
const CONTENT_WAIT_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAudioController(events: ControllerEvents) {
  let worker: Worker | null = null;
  let audio: HTMLAudioElement | null = null;
  let sections: AudioSection[] = [];
  let segments: Segment[] = [];
  let status: AudioStatus = 'idle';
  /** Incrémenté à chaque démarrage, arrêt ou échec : toute suite asynchrone d'une lecture périmée s'arrête. */
  let epoch = 0;
  let speakerId = 1;
  let speed = 1;
  let paused = false;
  /** Indice du segment en cours de lecture ou de préparation. */
  let current = 0;
  let openGate: (() => void) | null = null;
  /** Vrai tant que le segment courant n'est pas encore chargé dans l'élément <audio>. */
  let loading = false;
  let requestSeq = 0;
  const pending = new Map<
    number,
    { resolve: (s: Synthesized) => void; reject: (e: Error) => void }
  >();
  const synth = new Map<number, Promise<Synthesized>>();
  const ready = new Set<number>();

  function setStatus(next: AudioStatus): void {
    status = next;
    events.status(next);
  }

  function post(request: EngineRequest): void {
    worker?.postMessage(request);
  }

  function onEngine(message: EngineResponse): void {
    switch (message.type) {
      case 'progress':
        if (status === 'preparing' || status === 'downloading') {
          if (status !== 'downloading') setStatus('downloading');
          events.progress({ loaded: message.loaded, total: message.total });
        }
        break;
      case 'ready':
        events.progress(null);
        if (status === 'downloading') setStatus('preparing');
        break;
      case 'audio': {
        const waiter = pending.get(message.requestId);
        pending.delete(message.requestId);
        waiter?.resolve({ wav: pcmToWavBlob(message.pcm, message.sampleRate) });
        break;
      }
      case 'failed': {
        const waiter = message.requestId === undefined ? undefined : pending.get(message.requestId);
        if (message.requestId !== undefined) pending.delete(message.requestId);
        waiter?.reject(new Error(message.message));
        // Un échec de chargement n'a pas de demande attachée : il faut le signaler lui-même.
        if (message.requestId === undefined || waiter !== undefined) {
          fail({ code: message.code, message: message.message });
        }
        break;
      }
    }
  }

  function ensureWorker(): Worker {
    if (worker !== null) return worker;
    // Le chemin est écrit en clair : c'est ce qui permet à Vite d'empaqueter le worker.
    worker = new Worker(new URL('../workers/audioEngine.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<EngineResponse>) => onEngine(event.data);
    worker.onerror = () => {
      worker = null;
      fail({ code: 'synthesis', message: 'Le moteur vocal s’est arrêté.' });
    };
    return worker;
  }

  function releaseAudio(): void {
    if (audio === null) return;
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
    audio.removeAttribute('src');
    audio.load();
  }

  function cancelEverything(): void {
    epoch += 1;
    post({ type: 'cancel', requestId: 'all' });
    for (const waiter of pending.values()) waiter.reject(new Error('annulé'));
    pending.clear();
    synth.clear();
    ready.clear();
    paused = false;
    loading = false;
    openGate?.();
    openGate = null;
    releaseAudio();
  }

  function fail(failure: AudioFailure): void {
    if (status === 'error') return;
    cancelEverything();
    events.progress(null);
    events.failure(failure);
    events.section(null, sections.length);
    setStatus('error');
  }

  /** Demande la synthèse du segment `i` (une seule fois) ; sans effet au-delà de la fin. */
  function request(i: number): Promise<Synthesized> | undefined {
    if (i >= segments.length) return undefined;
    const known = synth.get(i);
    if (known !== undefined) return known;
    const requestId = (requestSeq += 1);
    const promise = new Promise<Synthesized>((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      post({ type: 'synthesize', requestId, text: segments[i].text, speakerId });
    }).then((result) => {
      ready.add(i);
      return result;
    });
    promise.catch(() => {}); // l'échec est traité par fail() ; évite un rejet non géré
    synth.set(i, promise);
    return promise;
  }

  async function playSegment(i: number, myEpoch: number): Promise<void> {
    if (myEpoch !== epoch) return;
    if (i >= segments.length) {
      finish();
      return;
    }
    current = i;
    const segment = segments[i];
    events.section(segment.sectionIndex, sections.length);
    for (let ahead = 0; ahead <= LOOKAHEAD; ahead++) request(i + ahead);

    if (!ready.has(i) && status !== 'downloading' && !paused) setStatus('preparing');
    loading = true;
    let result: Synthesized;
    try {
      result = await (synth.get(i) as Promise<Synthesized>);
    } catch {
      return; // fail() a déjà été appelé, ou la lecture a été annulée
    }
    if (myEpoch !== epoch) return;

    // En pause pendant la préparation : on attend la reprise avant de jouer.
    if (paused) {
      await new Promise<void>((resolve) => (openGate = resolve));
      if (myEpoch !== epoch) return;
    }

    const element = audio;
    if (element === null) return;
    const url = URL.createObjectURL(result.wav);
    if (element.src.startsWith('blob:')) URL.revokeObjectURL(element.src);
    element.src = url;
    loading = false;
    // La vitesse est réappliquée à chaque source : le navigateur la remet à zéro au chargement.
    element.defaultPlaybackRate = speed;
    element.playbackRate = speed;
    element.preservesPitch = true;
    element.onended = () => {
      synth.delete(i);
      ready.delete(i);
      void playSegment(i + 1, myEpoch);
    };
    element.onerror = () => fail({ code: 'synthesis', message: 'Le son n’a pas pu être lu.' });
    try {
      await element.play();
    } catch {
      if (myEpoch === epoch) {
        fail({ code: 'unsupported', message: 'Le navigateur a refusé de jouer le son.' });
      }
      return;
    }
    if (myEpoch === epoch && !paused) setStatus('playing');
  }

  function finish(): void {
    releaseAudio();
    synth.clear();
    ready.clear();
    events.section(null, sections.length);
    setStatus('ended');
  }

  /**
   * Reprend la lecture au premier segment de la section `sectionIndex`. Une lecture en pause le
   * reste : la section se prépare, elle ne se joue qu'à la reprise.
   */
  function restartAtSection(sectionIndex: number): void {
    const first = segments.findIndex((segment) => segment.sectionIndex === sectionIndex);
    if (first === -1) return;
    const wasPaused = status === 'paused';
    cancelEverything();
    const myEpoch = epoch;
    if (wasPaused) {
      paused = true;
      setStatus('paused');
    } else {
      setStatus('preparing');
    }
    void playSegment(first, myEpoch);
  }

  /** Lecture engagée (même en pause) : on peut s'y déplacer. */
  function isEngaged(): boolean {
    return (
      segments.length > 0 &&
      (status === 'playing' ||
        status === 'preparing' ||
        status === 'downloading' ||
        status === 'paused')
    );
  }

  /** Attend (au plus quelques secondes) que le contenu provisoire ait disparu de la page. */
  async function collectWhenReady(root: HTMLElement, myEpoch: number): Promise<AudioSection[]> {
    const startedAt = Date.now();
    for (;;) {
      const collected = collectSections(root);
      if (!collected.pending || Date.now() - startedAt > CONTENT_WAIT_MS) return collected.sections;
      await sleep(100);
      if (myEpoch !== epoch) return [];
    }
  }

  return {
    /** Doit être appelé depuis le geste de la personne (clic) : c'est ce qui autorise le son. */
    async start(root: HTMLElement, options: { speakerId: number; speed: number }): Promise<void> {
      cancelEverything();
      const myEpoch = epoch;
      events.failure(null);
      events.progress(null);
      speakerId = options.speakerId;
      speed = options.speed;
      // Avant toute vérification : fail() ignore un second échec tant que le statut est « erreur ».
      setStatus('preparing');

      if (typeof Audio === 'undefined' || typeof Worker === 'undefined') {
        fail({ code: 'unsupported', message: 'L’écoute n’est pas disponible dans ce navigateur.' });
        return;
      }
      // Un seul élément <audio>, « débloqué » ici par le clic : les segments suivants, qui
      // arrivent plusieurs secondes après, pourront alors se jouer (règle de lecture automatique).
      audio ??= new Audio();
      audio.src = URL.createObjectURL(pcmToWavBlob(new Float32Array(2205), 22050));
      void audio.play().catch(() => {});

      events.section(null, 0);
      sections = await collectWhenReady(root, myEpoch);
      if (myEpoch !== epoch) return;
      segments = sections.flatMap((section) =>
        section.chunks.map((text) => ({ sectionIndex: section.index, text })),
      );
      // Un corps fait seulement de blocs annoncés (du code, un schéma) n'a rien à lire : le titre
      // et le résumé seuls ne justifient pas une écoute.
      const hasBodyText = sections.some((s) => s.kind === 'text' || s.kind === 'image');
      if (segments.length === 0 || !hasBodyText) {
        fail({ code: 'empty', message: 'Cette fiche n’a rien à lire à voix haute.' });
        return;
      }
      events.section(null, sections.length);
      ensureWorker();
      post({ type: 'load' });
      await playSegment(0, myEpoch);
    },

    pause(): void {
      if (status !== 'playing' && status !== 'preparing' && status !== 'downloading') return;
      paused = true;
      audio?.pause();
      setStatus('paused');
    },

    resume(): void {
      if (status !== 'paused') return;
      paused = false;
      if (openGate !== null) {
        // La préparation du segment s'était terminée en pause : elle reprend et joue.
        const gate = openGate;
        openGate = null;
        setStatus('preparing');
        gate();
      } else if (loading || audio === null) {
        // Segment pas encore prêt : playSegment le jouera dès son arrivée, puisque la pause est levée.
        setStatus('preparing');
      } else {
        setStatus('playing');
        void audio
          .play()
          .catch(() =>
            fail({ code: 'unsupported', message: 'Le navigateur a refusé de jouer le son.' }),
          );
      }
    },

    stop(): void {
      cancelEverything();
      events.progress(null);
      events.failure(null);
      events.section(null, sections.length);
      setStatus('idle');
    },

    /**
     * Change de voix pendant la lecture : la section en cours reprend à son début avec la
     * nouvelle voix, sans repartir du début de la fiche. Les deux voix sont deux locuteurs du
     * même modèle : aucun téléchargement, seul ce qui était déjà synthétisé est jeté.
     */
    changeVoice(nextSpeakerId: number): void {
      speakerId = nextSpeakerId;
      if (!isEngaged()) return;
      restartAtSection(segments[Math.min(current, segments.length - 1)].sectionIndex);
    },

    /** Passe au début de la section suivante ; sans effet sur la dernière. */
    next(): void {
      if (!isEngaged()) return;
      const sectionIndex = segments[Math.min(current, segments.length - 1)].sectionIndex;
      if (sectionIndex + 1 < sections.length) restartAtSection(sectionIndex + 1);
    },

    /**
     * Revient au début de la section en cours si elle est entamée (plus de quelques secondes,
     * ou segment qui n'est pas le premier de la section) ; sinon à la section précédente.
     * Sans effet sur la première section.
     */
    previous(): void {
      if (!isEngaged()) return;
      const sectionIndex = segments[Math.min(current, segments.length - 1)].sectionIndex;
      if (sectionIndex === 0) return;
      const firstOfSection = segments.findIndex((segment) => segment.sectionIndex === sectionIndex);
      const started = current > firstOfSection || (audio?.currentTime ?? 0) > RESTART_AFTER_SECONDS;
      restartAtSection(started ? sectionIndex : sectionIndex - 1);
    },

    setSpeed(next: number): void {
      speed = next;
      if (audio !== null) {
        audio.defaultPlaybackRate = next;
        audio.playbackRate = next;
      }
    },

    /** Sections collectées au dernier démarrage (pour repérer celle qui est lue). */
    getSections(): readonly AudioSection[] {
      return sections;
    },

    /** Libère tout (démontage de la page) : le son, les demandes, le worker. */
    dispose(): void {
      cancelEverything();
      post({ type: 'dispose' });
      worker?.terminate();
      worker = null;
      audio = null;
      sections = [];
      segments = [];
    },
  };
}

export type AudioController = ReturnType<typeof createAudioController>;
