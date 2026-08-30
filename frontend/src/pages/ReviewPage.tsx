import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getDueReview, getMe, rateReview, type DueReview, type ReviewRating } from '../lib/reviews';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Button, Skeleton } from '@heroui/react';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { EntryMdx } from '../components/entry/EntryMdx';

const RATINGS: { rating: ReviewRating; label: string }[] = [
  { rating: 'AGAIN', label: 'Encore' },
  { rating: 'HARD', label: 'Difficile' },
  { rating: 'GOOD', label: 'Bien' },
  { rating: 'EASY', label: 'Facile' },
];

export function ReviewPage() {
  const navigate = useNavigate();
  const [due, setDue] = useState<DueReview | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((result) => {
        if (cancelled) return;
        if (result === 'unauthorized') {
          navigate('/login', { replace: true });
          return;
        }
        return getDueReview().then((data) => {
          if (!cancelled) setDue(data);
        });
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Impossible de charger les révisions');
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function onRate(rating: ReviewRating) {
    if (!due?.current || pending) return;
    setPending(true);
    setRateError(null);
    try {
      const result = await rateReview(due.current.id, rating);
      if (result === 'unauthorized') {
        navigate('/login', { replace: true });
        return;
      }
      setDue(result);
    } catch (caught: unknown) {
      setRateError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer la note');
    } finally {
      setPending(false);
    }
  }

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (due === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-3/4 rounded-lg" />
        <Skeleton className="h-5 w-1/2 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (due.current === null) {
    return <EmptyMessage>Rien à réviser pour le moment.</EmptyMessage>;
  }

  const { entry } = due.current;
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="border-border mb-8 border-b pb-6">
        <p className="text-muted mb-2 text-sm">
          {due.remaining} fiche{due.remaining > 1 ? 's' : ''} due{due.remaining > 1 ? 's' : ''}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{entry.title}</h1>
      </header>
      {entry.bodyMdx ? (
        <EntryMdx source={entry.bodyMdx} />
      ) : (
        <EmptyMessage>Cette fiche n’a pas encore de contenu.</EmptyMessage>
      )}
      <footer className="border-border flex flex-col gap-3 border-t pt-6">
        {rateError ? <ErrorMessage>{rateError}</ErrorMessage> : null}
        <div className="flex flex-wrap gap-2">
          {RATINGS.map(({ rating, label }) => (
            <Button
              key={rating}
              type="button"
              variant="secondary"
              isDisabled={pending}
              onPress={() => {
                void onRate(rating);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </footer>
    </article>
  );
}
