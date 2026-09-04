import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Skeleton } from '@heroui/react';
import { getMe } from '../lib/auth';
import { getDueReview, rateReview, type DueReview, type ReviewRating } from '../lib/reviews';
import { useAsyncData } from '../lib/useAsyncData';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { EntryMdx } from '../components/entry/EntryMdx';

/**
 * Les quatre notes de l'algorithme SM-2, de la plus sévère à la plus généreuse.
 * « Encore » remet la fiche à réviser tout de suite ; « Facile » l'éloigne le
 * plus possible.
 */
const RATINGS: { rating: ReviewRating; label: string }[] = [
  { rating: 'AGAIN', label: 'Encore' },
  { rating: 'HARD', label: 'Difficile' },
  { rating: 'GOOD', label: 'Bien' },
  { rating: 'EASY', label: 'Facile' },
];

/** `'unauthorized'` : session absente, la redirection est en cours. */
type ReviewState = DueReview | 'unauthorized';

export function ReviewPage() {
  const navigate = useNavigate();
  const [rateError, setRateError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const {
    data: due,
    error,
    setData: setDue,
  } = useAsyncData<ReviewState>(
    async () => {
      // La session est vérifiée côté serveur avant de demander les cartes.
      const me = await getMe();
      return me === 'unauthorized' ? 'unauthorized' : getDueReview();
    },
    [],
    'Impossible de charger les révisions',
  );

  useEffect(() => {
    if (due === 'unauthorized') {
      navigate('/login', { replace: true });
    }
  }, [due, navigate]);

  /**
   * Note la carte affichée.
   *
   * La réponse du serveur contient déjà la carte suivante : on l'installe
   * directement (`setDue`) au lieu de relancer `GET /reviews/due`.
   */
  async function onRate(rating: ReviewRating) {
    if (due === undefined || due === 'unauthorized' || !due.current || pending) {
      return;
    }

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

  // Chargement, ou redirection déjà lancée.
  if (due === undefined || due === 'unauthorized') {
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
