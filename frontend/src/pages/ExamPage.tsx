import { useEffect, useState, type SubmitEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Skeleton } from '@heroui/react';
import {
  startQuiz,
  submitQuiz,
  type StartQuizResult,
  type SubmitQuizResponse,
} from '../lib/quizzes';
import { getMe } from '../lib/auth';
import { useAsyncData } from '../lib/useAsyncData';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { ErrorMessage } from '../components/ui/ErrorMessage';

export function ExamPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SubmitQuizResponse | null>(null);

  /**
   * Démarre (ou reprend) l'épreuve.
   *
   * `startQuiz` renvoie soit le questionnaire, soit un cas d'échec nommé :
   * `'not_found'` (fiche inconnue), `'unavailable'` (le modèle de langage n'a
   * pas produit de QCM valide — le serveur refuse plutôt que d'inventer un
   * examen), `'unauthorized'` (session perdue).
   */
  const {
    data: exam,
    error,
    reload,
  } = useAsyncData<StartQuizResult>(
    async () => {
      if (!slug) return 'not_found';

      const me = await getMe();
      return me === 'unauthorized' ? 'unauthorized' : startQuiz(slug);
    },
    [slug],
    'Impossible de charger l’épreuve',
  );

  useEffect(() => {
    if (exam === 'unauthorized') {
      navigate('/login', { replace: true });
    }
  }, [exam, navigate]);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      exam === undefined ||
      typeof exam === 'string' ||
      exam.attempt === null ||
      pending ||
      result
    ) {
      return;
    }

    // Un groupe de boutons radio par question : `name` = id de la question,
    // `value` = index du choix.
    const form = new FormData(event.currentTarget);
    const answers = exam.attempt.questions.map((question) => ({
      questionId: question.id,
      choiceIndex: Number(form.get(question.id)),
    }));

    // `Number(null)` vaut 0, ce qui passerait pour une réponse valide : on
    // vérifie donc que chaque question a bien reçu un entier.
    if (answers.some((answer) => !Number.isInteger(answer.choiceIndex))) {
      setSubmitError('Réponds à toutes les questions.');
      return;
    }

    setPending(true);
    setSubmitError(null);

    try {
      const submitted = await submitQuiz(exam.attempt.id, answers);

      if (submitted === 'unauthorized') {
        navigate('/login', { replace: true });
        return;
      }
      if (submitted === 'bad_request') {
        setSubmitError('Réponds à toutes les questions avec un choix valide.');
        return;
      }
      if (submitted === 'not_found') {
        setSubmitError('Cette épreuve n’est plus disponible.');
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

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  // Chargement, ou redirection vers la connexion déjà lancée.
  if (exam === undefined || exam === 'unauthorized') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-3/4 rounded-lg" />
        <Skeleton className="h-5 w-1/2 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (exam === 'not_found') {
    return <EmptyMessage>Fiche introuvable.</EmptyMessage>;
  }

  // 503 côté serveur : la génération a échoué, mais rien n'est cassé côté
  // fiche — on propose simplement de réessayer.
  if (exam === 'unavailable') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <ErrorMessage>
          L’épreuve est temporairement indisponible. Réessaie dans un instant.
        </ErrorMessage>
        <Button type="button" onPress={reload}>
          Réessayer
        </Button>
      </div>
    );
  }

  // Fiche trop courte pour générer un QCM honnête.
  if (exam.attempt === null) {
    return <EmptyMessage>Pas d'épreuve pour cette fiche.</EmptyMessage>;
  }

  const { entry, attempt } = exam;

  // Après correction : score et récapitulatif question par question.
  if (result) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="border-border mb-8 border-b pb-6">
          <h1 className="text-3xl font-semibold tracking-tight">{result.entry.title}</h1>
          {result.entry.summary ? (
            <p className="text-muted mt-3 text-base">{result.entry.summary}</p>
          ) : null}
        </header>
        <p className="text-3xl font-semibold tracking-tight">{result.score} / 100</p>
        <p className="text-muted">
          {result.correctCount} / {result.total} bonnes réponses
        </p>
        <ol className="flex flex-col gap-6">
          {result.questions.map((question, index) => (
            <li
              key={question.id}
              className="border-border flex flex-col gap-2 rounded-lg border px-4 py-3"
            >
              <p className="font-medium">
                {index + 1}. {question.prompt}
              </p>
              <p>Ton choix : {question.selectedChoice}</p>
              <p>Bonne proposition : {question.correctChoice}</p>
            </li>
          ))}
        </ol>
        <p>
          <Link to={`/entries/${result.entry.slug}`} className="text-sm underline">
            Voir la fiche
          </Link>
        </p>
      </article>
    );
  }

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="border-border mb-8 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{entry.title}</h1>
        {entry.summary ? <p className="text-muted mt-3 text-base">{entry.summary}</p> : null}
      </header>
      <form className="flex flex-col gap-8" onSubmit={onSubmit}>
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
        <Button type="submit" isDisabled={pending}>
          Valider
        </Button>
      </form>
    </article>
  );
}
