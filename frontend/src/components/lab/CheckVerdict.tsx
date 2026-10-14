import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react';
import type { CheckCause, CheckOutcome } from '../../lib/pythonCheck';
import { Typo } from '../ui/Typo';

const CAUSES: Record<CheckCause, string> = {
  error: 'Le script s’est arrêté sur une erreur : la sortie n’a pas été comparée.',
  stopped: 'L’exécution a été arrêtée : la sortie n’a pas été comparée.',
  'timed-out': 'L’exécution a dépassé 30 secondes : la sortie n’a pas été comparée.',
  truncated: 'La sortie a dépassé la limite : elle n’a pas été comparée.',
};

/**
 * Verdict de « Vérifier » (spec 017). Composant de présentation : le verdict
 * vient de `checkOutcome`. « Réussi » et « À revoir » sont écrits en toutes
 * lettres avec un pictogramme, dans un `role="status"` annoncé par les
 * lecteurs d'écran : la couleur ne porte jamais l'information seule.
 */
export function CheckVerdict({
  outcome,
  authorInputUsed,
}: {
  outcome: CheckOutcome;
  /** La zone « Entrée » a été modifiée : la vérification a utilisé l'entrée de la fiche. */
  authorInputUsed: boolean;
}) {
  const Icon = outcome.passed ? CheckCircleIcon : WarningCircleIcon;

  return (
    <div
      role="status"
      className={`flex flex-col gap-2 rounded-lg border p-4 ${
        outcome.passed ? 'border-success/50' : 'border-border'
      }`}
    >
      <Typo variant="h4" as="p" className="text-foreground flex items-center gap-2">
        <Icon
          aria-hidden="true"
          weight="fill"
          className={`size-5 shrink-0 ${outcome.passed ? 'text-success' : 'text-muted'}`}
        />
        {outcome.passed ? 'Réussi' : 'À revoir'}
      </Typo>
      {outcome.passed ? (
        <Typo variant="small" as="p">
          La sortie correspond à la sortie attendue.
        </Typo>
      ) : 'cause' in outcome ? (
        <Typo variant="small" as="p">
          {CAUSES[outcome.cause]}
        </Typo>
      ) : (
        <>
          <Typo variant="small" as="p">
            Première différence à la ligne {outcome.line}.
          </Typo>
          <OutputLine label="Attendu" text={outcome.expected} />
          <OutputLine label="Obtenu" text={outcome.actual} />
        </>
      )}
      {authorInputUsed ? (
        <Typo variant="caption">
          La vérification utilise l’entrée prévue par la fiche, pas celle de la zone Entrée.
        </Typo>
      ) : null}
    </div>
  );
}

function OutputLine({ label, text }: { label: string; text: string | null }) {
  return (
    <Typo variant="small" as="p" className="text-foreground wrap-break-word">
      <span className="text-muted">{label} : </span>
      {text === null ? (
        <span className="text-muted italic">aucune ligne</span>
      ) : (
        // Espaces intérieurs visibles : ils comptent dans la comparaison.
        <code className="bg-blacksea-dark rounded px-1.5 py-0.5 font-mono whitespace-pre-wrap">
          {text}
        </code>
      )}
    </Typo>
  );
}
