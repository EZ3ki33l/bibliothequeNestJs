import { useEffect, useId, useRef, useState } from 'react';
import { Button, Label, ProgressBar } from '@heroui/react';
import { formatBytes } from '../../lib/entryImages';
import { checkOutcome, type CheckOutcome } from '../../lib/pythonCheck';
import {
  PYTHON_ENGINE_SIZE,
  PythonRunner,
  type OutputStream,
  type RunError,
  type RunEvent,
  type RunStatus,
} from '../../lib/pythonRunner';
import type { SandpackFiles } from '../../lib/stacks';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Typo } from '../ui/Typo';
import { CheckVerdict } from './CheckVerdict';
import { CodeEditor } from './CodeEditor';

type PythonPlaygroundProps = {
  files: SandpackFiles;
  /** Entrée standard prévue par le rédacteur ('' = aucune). */
  input: string;
  /** Sortie attendue ; vide : pas de bouton « Vérifier ». */
  expectedOutput: string;
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'downloading'; loaded: number; total: number }
  | { kind: 'starting' }
  | { kind: 'running' }
  | { kind: 'finished'; status: RunStatus; error?: RunError }
  | { kind: 'engine-failed'; reason: 'network' | 'unsupported' | 'unknown' };

type Chunk = { stream: OutputStream; text: string };

/** Explication française placée avant le message de Python. */
const ERROR_PREAMBLES: Record<string, string> = {
  EOFError: 'Le script a demandé une ligne d’entrée de plus que la zone Entrée n’en contient.',
  ModuleNotFoundError:
    'Seuls les modules de la bibliothèque standard de Python sont disponibles dans l’atelier.',
  MemoryError: 'Le script a épuisé la mémoire disponible.',
  MissingMain: 'Aucun script principal main.py : rien à exécuter.',
  LimitError: 'Le code ou l’entrée dépasse la taille permise.',
  InternalError: 'Le moteur Python s’est arrêté sur une erreur interne.',
};

const STATUS_MENTIONS: Partial<Record<RunStatus, string>> = {
  stopped: 'Exécution arrêtée.',
  'timed-out': 'Exécution arrêtée au bout de 30 secondes.',
  truncated: 'Sortie tronquée.',
};

const ENGINE_FAILURES = {
  network: 'Le moteur Python n’a pas pu être téléchargé. Vérifier la connexion, puis réessayer.',
  unsupported: 'Ce navigateur ne peut pas exécuter le moteur Python.',
  unknown: 'Le moteur Python n’a pas pu démarrer.',
} as const;

/**
 * Atelier Python d'une fiche (spec 017) : éditeur, zone « Entrée »,
 * exécution, arrêt, réinitialisation et, quand la fiche a une sortie attendue,
 * vérification.
 *
 * Rien n'est téléchargé avant le premier clic, et rien n'est conservé : code et
 * entrée modifiés vivent dans l'état du composant, jamais dans le stockage du
 * navigateur (la page de confidentialité le dit). L'exécution elle-même a lieu
 * hors de la page (`lib/pythonRunner.ts`).
 */
export function PythonPlayground({ files, input, expectedOutput }: PythonPlaygroundProps) {
  const inputId = useId();
  const runner = useRef<PythonRunner | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const [code, setCode] = useState(files);
  const [stdin, setStdin] = useState(input);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [output, setOutput] = useState<Chunk[]>([]);
  const [verdict, setVerdict] = useState<{
    outcome: CheckOutcome;
    authorInputUsed: boolean;
  } | null>(null);
  const lastMode = useRef<'run' | 'check'>('run');
  // Change à chaque lancement et à chaque réinitialisation : les événements
  // d'une exécution abandonnée ne modifient plus l'affichage.
  const runToken = useRef(0);

  useEffect(() => () => runner.current?.dispose(), []);

  const busy =
    phase.kind === 'downloading' || phase.kind === 'starting' || phase.kind === 'running';

  const start = (mode: 'run' | 'check') => {
    if (busy) return;
    lastMode.current = mode;
    runner.current ??= new PythonRunner();
    setOutput([]);
    setVerdict(null);
    setPhase({ kind: 'starting' });
    // La vérification exécute avec l'entrée du rédacteur : le verdict ne
    // dépend pas de ce que l'apprenant a tapé dans la zone « Entrée ».
    const authorInputUsed = mode === 'check' && stdin !== input;
    let stdout = '';
    const token = ++runToken.current;
    void runner.current.run(code, mode === 'check' ? input : stdin, (event: RunEvent) => {
      if (token !== runToken.current) return;
      switch (event.type) {
        case 'download':
          setPhase({ kind: 'downloading', loaded: event.loaded, total: event.total });
          break;
        case 'starting':
        case 'running':
          setPhase({ kind: event.type });
          break;
        case 'output':
          if (event.stream === 'stdout') stdout += event.text;
          setOutput((chunks) => appendChunk(chunks, event.stream, event.text));
          break;
        case 'finished':
          setPhase({ kind: 'finished', status: event.status, error: event.error });
          if (mode === 'check') {
            setVerdict({
              outcome: checkOutcome(event.status, expectedOutput, stdout),
              authorInputUsed,
            });
          }
          break;
        case 'engine-failed':
          setPhase({ kind: 'engine-failed', reason: event.reason });
          break;
      }
    });
  };

  const reset = () => {
    runToken.current++;
    runner.current?.stop();
    setCode(files);
    setStdin(input);
    setOutput([]);
    setVerdict(null);
    setPhase({ kind: 'idle' });
    setResetCount((count) => count + 1); // remonte l'éditeur sur le code d'origine
  };

  const error = phase.kind === 'finished' ? phase.error : undefined;
  const mention = phase.kind === 'finished' ? STATUS_MENTIONS[phase.status] : undefined;
  const hasOutput = output.length > 0 || error !== undefined || mention !== undefined;

  return (
    <section
      aria-label="Atelier Python"
      className="border-border overflow-hidden rounded-xl border"
    >
      <CodeEditor
        key={resetCount}
        files={files}
        onChange={(name, text) => setCode((current) => ({ ...current, [name]: text }))}
      />

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-medium">
            Entrée
          </label>
          <textarea
            id={inputId}
            value={stdin}
            onChange={(event) => setStdin(event.target.value)}
            rows={3}
            spellCheck={false}
            aria-describedby={`${inputId}-help`}
            className="border-border bg-background w-full rounded-lg border p-3 font-mono text-sm"
          />
          <Typo variant="caption" id={`${inputId}-help`}>
            Une ligne par appel à <code>input()</code>.
          </Typo>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" isDisabled={busy} onPress={() => start('run')}>
            Exécuter
          </Button>
          {expectedOutput !== '' ? (
            <Button
              type="button"
              variant="secondary"
              isDisabled={busy}
              onPress={() => start('check')}
            >
              Vérifier
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            isDisabled={!busy}
            onPress={() => runner.current?.stop()}
          >
            Arrêter
          </Button>
          <Button type="button" variant="ghost" onPress={reset}>
            Réinitialiser
          </Button>
        </div>

        {phase.kind === 'idle' ? (
          <Typo variant="caption">
            Le code s’exécute dans le navigateur, sans rien envoyer. Le premier lancement télécharge
            le moteur Python depuis le site (environ {formatBytes(PYTHON_ENGINE_SIZE)}), une seule
            fois.
          </Typo>
        ) : null}
        {phase.kind === 'downloading' ? (
          <ProgressBar
            value={Math.min(phase.loaded, phase.total)}
            minValue={0}
            maxValue={phase.total}
            valueLabel={`${formatBytes(phase.loaded)} sur ${formatBytes(phase.total)}`}
          >
            <Label>Téléchargement du moteur Python (une seule fois)</Label>
            <ProgressBar.Output />
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        ) : null}
        {phase.kind === 'starting' ? (
          <Typo variant="caption" role="status">
            Démarrage du moteur Python…
          </Typo>
        ) : null}
        {phase.kind === 'engine-failed' ? (
          <div className="flex flex-wrap items-center gap-3">
            <ErrorMessage>{ENGINE_FAILURES[phase.reason]}</ErrorMessage>
            {phase.reason === 'unsupported' ? null : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onPress={() => start(lastMode.current)}
              >
                Réessayer
              </Button>
            )}
          </div>
        ) : null}

        {/* Zone de journal : annoncée au fil de l'eau sans couper la parole.
            Le texte est rendu en nœuds texte, jamais interprété comme du HTML. */}
        <pre
          role="log"
          aria-live="polite"
          aria-label="Sortie du script"
          className={`bg-blacksea-dark text-foreground max-h-80 overflow-auto rounded-lg p-3 font-mono text-sm whitespace-pre-wrap ${
            hasOutput ? '' : 'hidden'
          }`}
        >
          {output.map((chunk, index) =>
            chunk.stream === 'stderr' ? (
              <span key={index} className="text-cherry-light">
                <span className="sr-only">Erreur : </span>
                {chunk.text}
              </span>
            ) : (
              <span key={index}>{chunk.text}</span>
            ),
          )}
          {error ? (
            <span className="text-cherry-light">
              <span className="sr-only">Erreur : </span>
              {ERROR_PREAMBLES[error.type] ? `${ERROR_PREAMBLES[error.type]}\n` : ''}
              {error.message}
            </span>
          ) : null}
        </pre>
        {mention ? (
          <Typo variant="small" as="p" role="status">
            {mention}
          </Typo>
        ) : null}

        {verdict ? (
          <CheckVerdict outcome={verdict.outcome} authorInputUsed={verdict.authorInputUsed} />
        ) : null}
      </div>
    </section>
  );
}

/** Ajoute un morceau de sortie, fusionné au précédent s'il vient du même flux. */
function appendChunk(chunks: Chunk[], stream: OutputStream, text: string): Chunk[] {
  const last = chunks[chunks.length - 1];
  if (last && last.stream === stream) {
    return [...chunks.slice(0, -1), { stream, text: last.text + text }];
  }
  return [...chunks, { stream, text }];
}
