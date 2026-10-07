import { useEffect, useState, type ReactNode, type SubmitEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Button, Skeleton, buttonVariants } from '@heroui/react';
import {
  startQuiz,
  submitQuiz,
  type StartQuizResult,
  type SubmitQuizResponse,
} from '../lib/quizzes';
import { getMe } from '../lib/auth';
import { entryHrefFromPath, getLearningPath } from '../lib/learningPaths';
import { adjacentSteps } from '../lib/pathSteps';
import { examExits, formatRetryTime } from '../lib/examResult';
import { usePageTitle } from '../lib/pageTitle';
import { useAsyncData } from '../lib/useAsyncData';
import { useLoginRedirect } from '../lib/useLoginRedirect';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { NotFoundState } from '../components/ui/NotFoundState';
import { ExamResult } from '../components/exam/ExamResult';

const INCOMPLETE = 'Toutes les questions attendent une réponse.';
const UNAVAILABLE =
  'L’examen ne peut pas être préparé pour le moment. Un nouvel essai est possible dans un instant.';
const FORBIDDEN = 'L’examen de cette fiche demande une adresse vérifiée.';

/** Message du plafond d'examens, avec l'heure du prochain essai quand elle est connue. */
function limitedMessage(retryAt: string | null): string {
  const time = formatRetryTime(retryAt);

  return time
    ? `Trop d’examens démarrés. Un nouvel essai sera possible à ${time}.`
    : 'Trop d’examens démarrés. Un nouvel essai sera possible plus tard.';
}

/**
 * Examen d'une fiche : questionnaire, puis résultat et suites.
 *
 * Aucun état de cette page ne laisse sans suite : chargement, plafond atteint,
 * examen indisponible, examen refusé, fiche sans examen ou introuvable
 * proposent tous au moins un lien.
 *
 * Un examen **refusé** (403) n'est pas une panne : la fiche est réservée et
 * l'adresse du compte n'est pas vérifiée. Ses questions sont tirées du
 * contenu, le serveur ne les donne donc pas à qui ne peut pas lire la fiche.
 * La page l'explique et renvoie à la fiche, où se demande le message de
 * vérification.
 *
 * Le parcours d'origine (`?parcours=`) suit la fiche jusqu'ici, pour que le
 * résultat propose l'étape suivante. Comme sur la fiche, ce paramètre ne porte
 * qu'un slug : il sert à relire le plan **public** du parcours, il n'ouvre
 * aucun droit. Un parcours inconnu ou en brouillon donne un résultat sans lien
 * de parcours.
 */
export function ExamPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const fromPath = searchParams.get('parcours');
  const redirectToLogin = useLoginRedirect();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SubmitQuizResponse | null>(null);
  // Nouvel examen en préparation (« Recommencer », « Réessayer »).
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

  /**
   * Démarre (ou reprend) l'épreuve.
   *
   * `startQuiz` renvoie soit le questionnaire, soit un cas d'échec nommé :
   * `'not_found'` (fiche inconnue), `'unavailable'` (le modèle de langage n'a
   * pas produit de QCM valide — le serveur refuse plutôt que d'inventer un
   * examen), `'unauthorized'` (session perdue), `'forbidden'` (fiche réservée,
   * adresse non vérifiée), ou le plafond d'examens.
   */
  const {
    data: exam,
    error,
    reload,
    setData: setExam,
  } = useAsyncData<StartQuizResult>(
    async () => {
      if (!slug) return 'not_found';

      const me = await getMe();
      return me === 'unauthorized' ? 'unauthorized' : startQuiz(slug);
    },
    [slug],
    'Impossible de charger l’examen',
  );

  // Plan public du parcours d'origine. Erreur ignorée : sans lui, le résultat
  // se comporte comme hors parcours.
  const { data: path } = useAsyncData(
    () => (fromPath ? getLearningPath(fromPath) : Promise.resolve(null)),
    [fromPath],
    'Impossible de charger le parcours',
  );

  const started = typeof exam === 'object' && 'entry' in exam ? exam : null;

  // Le titre de la fiche n'arrive qu'avec une fiche publiée : avant, ou si elle
  // est introuvable, l'onglet garde le titre neutre.
  usePageTitle(started ? `Examen : ${started.entry.title}` : undefined);

  useEffect(() => {
    if (exam === 'unauthorized') {
      redirectToLogin();
    }
  }, [exam, redirectToLogin]);

  // `null` hors parcours, ou si la fiche n'est pas une étape du parcours de
  // l'adresse : aucun lien de parcours n'est alors proposé.
  const steps = slug && fromPath ? adjacentSteps(path, slug) : null;
  const pathSlug = steps ? fromPath : null;
  const entryHref = slug
    ? pathSlug
      ? entryHrefFromPath(slug, pathSlug)
      : `/entries/${slug}`
    : '/stacks';

  /**
   * Prépare un nouvel examen sans repasser par la fiche.
   *
   * La tentative précédente étant terminée, le serveur en génère une nouvelle.
   * Le résultat affiché n'est retiré qu'une fois les nouvelles questions
   * arrivées : si la préparation échoue (plafond, indisponibilité), le
   * récapitulatif reste à l'écran avec l'explication.
   */
  async function restart() {
    if (!slug || restarting) return;

    setRestarting(true);
    setRestartError(null);
    setSubmitError(null);

    try {
      const next = await startQuiz(slug);

      if (next === 'unauthorized') {
        redirectToLogin();
        return;
      }

      if (result && typeof next === 'object' && 'limited' in next) {
        setRestartError(limitedMessage(next.retryAt));
        return;
      }
      if (result && next === 'unavailable') {
        setRestartError(UNAVAILABLE);
        return;
      }
      // Fiche refermée depuis l'examen précédent : le récapitulatif reste à
      // l'écran, avec l'explication.
      if (result && next === 'forbidden') {
        setRestartError(FORBIDDEN);
        return;
      }

      setExam(next);
      setResult(null);
    } catch {
      setRestartError('Impossible de préparer un nouvel examen.');
    } finally {
      setRestarting(false);
    }
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!started || started.attempt === null || pending || result) {
      return;
    }

    // Un groupe de boutons radio par question : `name` = id de la question,
    // `value` = index du choix.
    const form = new FormData(event.currentTarget);
    const answers = started.attempt.questions.map((question) => ({
      questionId: question.id,
      // `form.get` vaut `null` sans réponse, et `Number(null)` vaut 0 : la
      // valeur absente est écartée avant la conversion.
      choiceIndex: form.get(question.id) === null ? Number.NaN : Number(form.get(question.id)),
    }));

    if (answers.some((answer) => !Number.isInteger(answer.choiceIndex))) {
      setSubmitError(INCOMPLETE);
      return;
    }

    setPending(true);
    setSubmitError(null);

    try {
      const submitted = await submitQuiz(started.attempt.id, answers);

      if (submitted === 'unauthorized') {
        redirectToLogin();
        return;
      }
      if (submitted === 'bad_request') {
        setSubmitError(INCOMPLETE);
        return;
      }
      if (submitted === 'not_found') {
        setSubmitError('Cet examen n’est plus disponible.');
        return;
      }
      // Fiche refermée pendant l'examen : le questionnaire, tiré d'un contenu
      // que ce compte ne peut plus lire, cède la place à l'explication.
      if (submitted === 'forbidden') {
        setExam('forbidden');
        return;
      }

      setResult(submitted);
    } catch (caught: unknown) {
      setSubmitError(
        caught instanceof Error ? caught.message : 'Impossible d’enregistrer le score',
      );
    } finally {
      setPending(false);
    }
  }

  const entryLink = (
    <Link to={entryHref} className={`${buttonVariants({ variant: 'secondary' })} no-underline`}>
      Voir la fiche
    </Link>
  );

  if (error) {
    return (
      <Fallback>
        <ErrorMessage>{error}</ErrorMessage>
        <Actions>
          <Button type="button" variant="primary" onPress={reload}>
            Réessayer
          </Button>
          {entryLink}
        </Actions>
      </Fallback>
    );
  }

  // Chargement, ou redirection vers la connexion déjà lancée.
  if (exam === undefined || exam === 'unauthorized') {
    return (
      <Fallback>
        {/* La génération prend quelques secondes : le dire évite de croire à
            une page figée. `role="status"` l'annonce aux lecteurs d'écran. */}
        <p role="status" className="text-muted text-sm">
          Préparation des questions…
        </p>
        <Skeleton className="h-10 w-3/4 rounded-lg" />
        <Skeleton className="h-5 w-1/2 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </Fallback>
    );
  }

  if (exam === 'not_found') {
    return (
      <NotFoundState
        message="Fiche introuvable."
        listLink={{ to: '/stacks', label: 'Toutes les leçons' }}
      />
    );
  }

  // 403 : la fiche est réservée et l'adresse du compte n'est pas vérifiée. La
  // fiche, elle, s'ouvre : c'est là que se demande le message de vérification.
  if (exam === 'forbidden') {
    return (
      <Fallback>
        <p role="status" className="text-sm">
          {FORBIDDEN}
        </p>
        <p className="text-muted text-sm">
          Le message de vérification se demande depuis la fiche, ou depuis « Mon compte ».
        </p>
        <Actions>
          <Link to={entryHref} className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
            Voir la fiche
          </Link>
        </Actions>
      </Fallback>
    );
  }

  // 503 côté serveur : la génération a échoué, mais rien n'est cassé côté
  // fiche. Réessayer est la bonne réaction, revenir à la fiche l'autre issue.
  if (exam === 'unavailable') {
    return (
      <Fallback>
        <ErrorMessage>{UNAVAILABLE}</ErrorMessage>
        {restartError ? <ErrorMessage>{restartError}</ErrorMessage> : null}
        <Actions>
          <Button
            type="button"
            variant="primary"
            isDisabled={restarting}
            onPress={() => void restart()}
          >
            {restarting ? 'Préparation des questions…' : 'Réessayer'}
          </Button>
          {entryLink}
        </Actions>
      </Fallback>
    );
  }

  // 429 : trop d'examens démarrés dans l'heure. Rien n'a été créé ; l'écran
  // dit quand un nouvel essai sera possible.
  if ('limited' in exam) {
    return (
      <Fallback>
        <ErrorMessage>{limitedMessage(exam.retryAt)}</ErrorMessage>
        <Actions>{entryLink}</Actions>
      </Fallback>
    );
  }

  const { entry, attempt } = exam;

  // Fiche trop courte pour un QCM honnête : pas d'examen, et la lecture suffit.
  if (attempt === null) {
    return (
      <Fallback>
        <h1 className="text-3xl font-semibold tracking-tight">{entry.title}</h1>
        <p className="text-muted">
          Cette fiche n’a pas d’examen : sa lecture suffit à valider l’étape.
        </p>
        <Actions>
          <Link to={entryHref} className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
            Voir la fiche
          </Link>
        </Actions>
      </Fallback>
    );
  }

  // Après correction : verdict, récapitulatif et suites.
  if (result) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="border-border border-b pb-6">
          <p className="text-muted mb-2 text-xs tracking-wide uppercase">Résultat de l’examen</p>
          <h1 className="text-3xl font-semibold tracking-tight">{result.entry.title}</h1>
        </header>
        <ExamResult
          result={result}
          exits={examExits({
            passed: result.passed,
            entrySlug: result.entry.slug,
            pathSlug,
            steps,
          })}
          onRetry={() => void restart()}
          retryPending={restarting}
          retryError={restartError}
        />
      </article>
    );
  }

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="border-border mb-8 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{entry.title}</h1>
        {entry.summary ? <p className="text-muted mt-3 text-base">{entry.summary}</p> : null}
        {/* Les questions ne sont relues par personne avant d'être posées :
            le dire ici, là où elles sont lues (FR-035). */}
        <p className="text-muted mt-4 text-xs">
          Questions générées automatiquement à partir du contenu de la fiche : elles peuvent
          comporter des erreurs.
        </p>
      </header>
      {/* `key` : un nouvel examen repart d'un formulaire vierge, sans réponse
          cochée héritée du précédent.
          `noValidate` : les champs restent `required` (un lecteur d'écran
          l'annonce), mais c'est la page qui signale un examen incomplet, avec
          son propre message, au lieu de la bulle du navigateur. */}
      <form key={attempt.id} noValidate className="flex flex-col gap-8" onSubmit={onSubmit}>
        <ol className="flex flex-col gap-8">
          {attempt.questions.map((question, index) => (
            <li key={question.id}>
              <fieldset className="flex flex-col gap-3">
                <legend className="font-medium">
                  {index + 1}. {question.prompt}
                </legend>
                <ul className="flex flex-col gap-2">
                  {question.choices.map((choice, choiceIndex) => (
                    <li key={`${question.id}-${choiceIndex}`}>
                      <label
                        htmlFor={`${question.id}-${choiceIndex}`}
                        className="border-border flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm"
                      >
                        <input
                          id={`${question.id}-${choiceIndex}`}
                          type="radio"
                          name={question.id}
                          value={choiceIndex}
                          required
                          disabled={pending}
                        />
                        {choice}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </li>
          ))}
        </ol>
        {submitError ? <ErrorMessage>{submitError}</ErrorMessage> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" isDisabled={pending}>
            {pending ? 'Correction…' : 'Valider'}
          </Button>
          <Link to={entryHref} className="text-muted hover:text-foreground text-sm underline">
            Revenir à la fiche
          </Link>
        </div>
      </form>
    </article>
  );
}

/** Cadre des états sans questionnaire (attente, refus, absence d'examen). */
function Fallback({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">{children}</div>;
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
