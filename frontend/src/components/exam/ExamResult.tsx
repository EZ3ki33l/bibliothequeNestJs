import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Button, buttonVariants } from '@heroui/react';
import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react';
import type { SubmitQuizResponse } from '../../lib/quizzes';
import type { ExamExit } from '../../lib/examResult';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Typo } from '../ui/Typo';

type ExamResultProps = {
  result: SubmitQuizResponse;
  /** Suites proposées, dans l'ordre, calculées par `examExits`. */
  exits: ExamExit[];
  onRetry: () => void;
  /** Un nouvel examen est en cours de préparation. */
  retryPending: boolean;
  /** Pourquoi « Recommencer » n'a pas abouti (plafond, indisponibilité). */
  retryError?: string | null;
};

/**
 * Résultat d'un examen : verdict, score et seuil, récapitulatif, suites.
 *
 * Composant de présentation : il ne charge rien et ne décide rien. Le verdict
 * et le seuil viennent du serveur (`result.passed`, `result.passingScore`), les
 * suites de `examExits`.
 *
 * Accessibilité :
 * - le verdict est dans un élément `role="status"` et reçoit le focus à son
 *   affichage : un lecteur d'écran l'annonce, et la page remonte dessus alors
 *   que l'apprenant vient de cliquer « Valider », tout en bas du questionnaire ;
 * - « réussi / non réussi » et « Juste / À revoir » sont écrits en toutes
 *   lettres avec un pictogramme : la couleur ne porte jamais l'information seule.
 */
export function ExamResult({ result, exits, onRetry, retryPending, retryError }: ExamResultProps) {
  const verdictRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    verdictRef.current?.focus();
  }, [result.id]);

  const VerdictIcon = result.passed ? CheckCircleIcon : XCircleIcon;

  return (
    <div className="flex flex-col gap-8">
      <div
        ref={verdictRef}
        role="status"
        tabIndex={-1}
        className={`flex flex-col gap-2 rounded-xl border p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus) ${
          result.passed ? 'border-success/50' : 'border-border'
        }`}
      >
        <Typo variant="h4" as="p" className="text-foreground flex items-center gap-2">
          <VerdictIcon
            aria-hidden="true"
            weight="fill"
            className={`size-6 shrink-0 ${result.passed ? 'text-success' : 'text-muted'}`}
          />
          {result.passed ? 'Examen réussi' : 'Examen non réussi'}
        </Typo>
        <Typo variant="h2" as="p">
          {result.score} / 100
        </Typo>
        <Typo variant="small" as="p">
          Seuil de réussite : {result.passingScore} / 100 · {result.correctCount} / {result.total}{' '}
          {result.correctCount > 1 ? 'bonnes réponses' : 'bonne réponse'}
        </Typo>
      </div>

      <nav aria-label="Suite de l’examen" className="flex flex-wrap items-center gap-3">
        {exits.map((exit) =>
          exit.kind === 'retry' ? (
            <Button
              key={exit.kind}
              type="button"
              variant={exit.primary ? 'primary' : 'ghost'}
              isDisabled={retryPending}
              onPress={onRetry}
            >
              {retryPending ? 'Préparation des questions…' : exit.label}
            </Button>
          ) : (
            <Link
              key={exit.kind}
              to={exit.to ?? '/'}
              className={`${buttonVariants({ variant: exit.primary ? 'primary' : 'secondary' })} no-underline`}
            >
              {exit.label}
            </Link>
          ),
        )}
      </nav>
      {retryError ? <ErrorMessage>{retryError}</ErrorMessage> : null}

      <section aria-labelledby="exam-recap-heading" className="flex flex-col gap-4">
        <Typo variant="h3" as="h2" id="exam-recap-heading">
          Récapitulatif
        </Typo>
        <ol className="flex flex-col gap-4">
          {result.questions.map((question, index) => {
            const isCorrect = question.selectedIndex === question.correctIndex;
            const MarkIcon = isCorrect ? CheckCircleIcon : XCircleIcon;

            return (
              <li
                key={question.id}
                className="border-border flex flex-col gap-2 rounded-lg border px-4 py-3"
              >
                <Typo
                  variant="caption"
                  className={`flex items-center gap-1.5 font-semibold ${
                    isCorrect ? 'text-success' : 'text-cherry-light'
                  }`}
                >
                  <MarkIcon aria-hidden="true" weight="fill" className="size-4 shrink-0" />
                  {isCorrect ? 'Juste' : 'À revoir'}
                </Typo>
                <Typo variant="p" className="text-foreground font-medium wrap-break-word">
                  {index + 1}. {question.prompt}
                </Typo>
                {isCorrect ? (
                  // Une question juste : la réponse choisie **est** la bonne,
                  // l'afficher deux fois n'apprendrait rien.
                  <Typo variant="small" as="p" className="text-foreground wrap-break-word">
                    <span className="text-muted">Réponse : </span>
                    {question.correctChoice}
                  </Typo>
                ) : (
                  <>
                    <Typo variant="small" as="p" className="text-foreground wrap-break-word">
                      <span className="text-muted">Réponse choisie : </span>
                      {question.selectedChoice}
                    </Typo>
                    <Typo variant="small" as="p" className="text-foreground wrap-break-word">
                      <span className="text-muted">Bonne réponse : </span>
                      {question.correctChoice}
                    </Typo>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
