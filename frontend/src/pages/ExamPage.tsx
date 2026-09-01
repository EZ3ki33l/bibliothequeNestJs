import { useEffect, useState, type SubmitEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  startQuiz,
  submitQuiz,
  type StartQuizResponse,
  type SubmitQuizResponse,
} from '../lib/quizzes';
import { getMe } from '../lib/reviews';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Button, Skeleton } from '@heroui/react';
import { EmptyMessage } from '../components/ui/EmptyMessage';

export function ExamPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<StartQuizResponse | 'not_found' | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SubmitQuizResponse | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        if (me === 'unauthorized') {
          navigate('/login', { replace: true });
          return;
        }
        return startQuiz(slug).then((data) => {
          if (cancelled) return;
          if (data === 'unauthorized') {
            navigate('/login', { replace: true });
            return;
          }
          if (data === 'not_found') {
            setExam('not_found');
            return;
          }
          setExam(data);
        });
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Impossible de charger l’épreuve');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exam || exam === 'not_found' || exam.attempt === null || pending || result) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const answers = exam.attempt.questions.map((question) => {
      const raw = form.get(question.id);
      return { questionId: question.id, choiceIndex: Number(raw) };
    });

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

  if (!slug || exam === undefined) {
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

  if (exam.attempt === null) {
    return <EmptyMessage>Pas d'épreuve pour cette fiche.</EmptyMessage>;
  }

  const { entry, attempt } = exam;

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
