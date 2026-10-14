/**
 * Atelier Python, côté page (spec 017). La page télécharge le moteur depuis le
 * site (même origine, cache HTTP normal) et le donne à une iframe
 * `sandbox="allow-scripts"` d'origine opaque, qui exécute le code dans un
 * worker. La page tient la limite de durée et l'arrêt forcé ; elle ne fait
 * jamais confiance à un message qui ne vient pas de son iframe.
 * Protocole : specs/017-python-runtime/contracts/runner-protocol.md.
 */

import { MAX_PLAYGROUND_TEXT_LENGTH } from './playgroundEnvironments';

const ENGINE_FILES = [
  'pyodide.js',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
] as const;
type EngineFile = (typeof ENGINE_FILES)[number];
type EngineAssets = Record<EngineFile, ArrayBuffer>;

const ENGINE_VERSION = String(import.meta.env.VITE_PYODIDE_VERSION);
/** Taille du moteur avant compression, en octets (annoncée au premier lancement). */
export const PYTHON_ENGINE_SIZE = Number(import.meta.env.VITE_PYODIDE_SIZE);

export const RUN_TIMEOUT_MS = 30_000;
const STOP_GRACE_MS = 500;
const MAX_OUTPUT_CHARS = 200_000;
const MAX_OUTPUT_LINES = 10_000;
// Mêmes bornes que le serveur (PLAYGROUND_FILES_LIMITS) : le code modifié par
// l'apprenant ne doit pas dépasser ce qu'une fiche peut porter.
const MAX_FILES = 20;
const MAX_FILE_LENGTH = 20_000;
const MAX_STDIN_LENGTH = MAX_PLAYGROUND_TEXT_LENGTH;

/** Ne jamais ajouter de jeton : avec `allow-same-origin`, le code d'un brouillon agirait avec la session du lecteur. */
const SANDBOX = 'allow-scripts';
const RUNNER_URL = '/python-runner/runner.html';

export type OutputStream = 'stdout' | 'stderr';
export type RunStatus = 'ok' | 'error' | 'stopped' | 'timed-out' | 'truncated';
export type RunError = { type: string; message: string };

export type RunEvent =
  | { type: 'download'; loaded: number; total: number }
  | { type: 'starting' }
  | { type: 'running' }
  | { type: 'output'; stream: OutputStream; text: string }
  | { type: 'finished'; status: RunStatus; error?: RunError }
  | { type: 'engine-failed'; reason: 'network' | 'unsupported' | 'unknown' };

// Gardé pour toute la visite : une seconde iframe (après un arrêt forcé, ou
// sur une autre fiche) reçoit ces octets sans nouveau téléchargement.
let engineDownload: Promise<EngineAssets> | null = null;

function downloadEngine(onProgress: (loaded: number) => void): Promise<EngineAssets> {
  engineDownload ??= (async () => {
    let loaded = 0;
    const entries = await Promise.all(
      ENGINE_FILES.map(async (name) => {
        const response = await fetch(`/pyodide/${ENGINE_VERSION}/${name}`);
        if (!response.ok || !response.body) throw new Error(name);
        const reader = response.body.getReader();
        const parts: Uint8Array<ArrayBuffer>[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          // Le corps d'une réponse n'est jamais un SharedArrayBuffer.
          parts.push(value as Uint8Array<ArrayBuffer>);
          loaded += value.length;
          onProgress(loaded);
        }
        return [name, await new Blob(parts).arrayBuffer()] as const;
      }),
    );
    return Object.fromEntries(entries) as EngineAssets;
  })().catch((error: unknown) => {
    engineDownload = null; // « Réessayer » relance le téléchargement
    throw error;
  });
  return engineDownload;
}

type CurrentRun = {
  runId: string;
  onEvent: (event: RunEvent) => void;
  sent: boolean;
  halt: RunStatus | null;
  chars: number;
  lines: number;
  timers: number[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRunError(value: unknown): value is RunError {
  return isRecord(value) && typeof value.type === 'string' && typeof value.message === 'string';
}

const RUN_STATUSES: readonly string[] = ['ok', 'error', 'stopped', 'truncated'];

export class PythonRunner {
  private frame: HTMLIFrameElement | null = null;
  private ready: Promise<boolean> = Promise.resolve(false);
  private resolveReady: ((ready: boolean) => void) | null = null;
  private current: CurrentRun | null = null;
  private disposed = false;

  constructor() {
    window.addEventListener('message', this.onMessage);
  }

  /** Lance `main.py` ; les événements arrivent par `onEvent`, sans exception. */
  async run(
    files: Record<string, string>,
    stdin: string,
    onEvent: (event: RunEvent) => void,
  ): Promise<void> {
    if (this.current) return;
    const run: CurrentRun = {
      runId: crypto.randomUUID(),
      onEvent,
      sent: false,
      halt: null,
      chars: 0,
      lines: 0,
      timers: [],
    };
    this.current = run;

    const entries = Object.entries(files);
    if (
      entries.length > MAX_FILES ||
      entries.some(([, code]) => code.length > MAX_FILE_LENGTH) ||
      stdin.length > MAX_STDIN_LENGTH
    ) {
      this.finish(run, 'error', { type: 'LimitError', message: '' });
      return;
    }

    let engine: EngineAssets;
    try {
      engine = await downloadEngine((loaded) =>
        onEvent({ type: 'download', loaded, total: PYTHON_ENGINE_SIZE }),
      );
    } catch {
      if (this.current === run) {
        this.current = null;
        onEvent({ type: 'engine-failed', reason: 'network' });
      }
      return;
    }
    if (this.current !== run) return;

    onEvent({ type: 'starting' });
    this.ensureFrame(engine);
    if (!(await this.ready) || this.current !== run || !this.frame) return;

    this.post({ type: 'run', runId: run.runId, files, stdin });
    run.sent = true;
    this.newReady(); // le worker préparé est consommé ; un autre se prépare
    onEvent({ type: 'running' });
    run.timers.push(window.setTimeout(() => this.halt(run, 'timed-out'), RUN_TIMEOUT_MS));
  }

  stop(): void {
    if (this.current) this.halt(this.current, 'stopped');
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('message', this.onMessage);
    if (this.current) this.current.timers.forEach(clearTimeout);
    this.current = null;
    this.removeFrame();
  }

  private halt(run: CurrentRun, status: RunStatus): void {
    if (this.current !== run || run.halt) return;
    run.halt = status;
    if (!run.sent) {
      this.finish(run, status);
      return;
    }
    this.post({ type: 'stop', runId: run.runId });
    // Sans réponse, l'iframe est retirée : tout ce qu'elle contient s'arrête.
    run.timers.push(
      window.setTimeout(() => {
        if (this.current !== run) return;
        this.removeFrame();
        this.finish(run, status);
        void engineDownload?.then((engine) => this.ensureFrame(engine));
      }, STOP_GRACE_MS),
    );
  }

  private finish(run: CurrentRun, status: RunStatus, error?: RunError): void {
    run.timers.forEach(clearTimeout);
    if (this.current === run) this.current = null;
    run.onEvent({ type: 'finished', status, ...(error ? { error } : {}) });
  }

  private newReady(): void {
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  private ensureFrame(engine: EngineAssets): void {
    if (this.frame || this.disposed) return;
    this.newReady();
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', SANDBOX);
    frame.src = RUNNER_URL;
    frame.hidden = true;
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.title = 'Exécution Python';
    frame.addEventListener('load', () => {
      if (this.frame !== frame) return;
      // Origine opaque : seul « * » l'atteint. Rien de secret ne circule, le
      // code vient de la page elle-même.
      this.post({ type: 'init', parentOrigin: window.location.origin });
      const copies = Object.fromEntries(
        ENGINE_FILES.map((name) => [name, engine[name].slice(0)]),
      ) as EngineAssets;
      this.post({ type: 'engine', version: ENGINE_VERSION, assets: copies }, Object.values(copies));
    });
    this.frame = frame;
    document.body.append(frame);
  }

  private removeFrame(): void {
    this.frame?.remove();
    this.frame = null;
    this.resolveReady?.(false);
    this.resolveReady = null;
  }

  private post(message: unknown, transfer: Transferable[] = []): void {
    this.frame?.contentWindow?.postMessage(message, '*', transfer);
  }

  private onMessage = (event: MessageEvent): void => {
    if (
      !this.frame ||
      event.source !== this.frame.contentWindow ||
      event.origin !== 'null' ||
      !isRecord(event.data)
    ) {
      return;
    }
    const message = event.data;
    const run = this.current;

    if (message.type === 'ready') {
      this.resolveReady?.(true);
      return;
    }
    if (message.type === 'engine-failed') {
      this.removeFrame();
      if (run) {
        run.timers.forEach(clearTimeout);
        this.current = null;
        run.onEvent({
          type: 'engine-failed',
          reason: message.reason === 'unsupported' ? 'unsupported' : 'unknown',
        });
      }
      return;
    }
    if (!run || message.runId !== run.runId) return;

    if (message.type === 'output' && Array.isArray(message.chunks)) {
      if (run.halt) return;
      for (const chunk of message.chunks as unknown[]) {
        if (
          !isRecord(chunk) ||
          (chunk.stream !== 'stdout' && chunk.stream !== 'stderr') ||
          typeof chunk.text !== 'string'
        ) {
          continue;
        }
        this.emitOutput(run, chunk.stream, chunk.text);
        if (run.halt) return;
      }
    } else if (
      message.type === 'finished' &&
      typeof message.status === 'string' &&
      RUN_STATUSES.includes(message.status)
    ) {
      // Un arrêt demandé par la page garde sa cause (durée, troncature).
      this.finish(
        run,
        run.halt ?? (message.status as RunStatus),
        isRunError(message.error) ? message.error : undefined,
      );
    }
  };

  // Seconde borne, au cas où l'iframe ne tiendrait pas la sienne.
  private emitOutput(run: CurrentRun, stream: OutputStream, text: string): void {
    let kept = text.slice(0, MAX_OUTPUT_CHARS - run.chars);
    const lines = kept.split('\n');
    if (run.lines + lines.length - 1 > MAX_OUTPUT_LINES) {
      kept = lines.slice(0, MAX_OUTPUT_LINES - run.lines).join('\n');
    }
    run.chars += kept.length;
    run.lines += kept.split('\n').length - 1;
    if (kept !== '') run.onEvent({ type: 'output', stream, text: kept });
    if (kept.length < text.length) this.halt(run, 'truncated');
  }
}
