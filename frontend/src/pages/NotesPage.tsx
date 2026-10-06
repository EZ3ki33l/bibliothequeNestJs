import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, Skeleton } from '@heroui/react';
import { getMe } from '../lib/auth';
import { deleteNote, listNotes, type NotesPage as NotesPageData } from '../lib/notes';
import { useAsyncData } from '../lib/useAsyncData';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { EntryCard } from '../components/ui/EntryCard';
import { PageHeader } from '../components/ui/PageHeader';

/** `'unauthorized'` : session absente, la redirection est en cours. */
type NotesState = NotesPageData | 'unauthorized';

const EXCERPT_LENGTH = 160;

function excerpt(content: string): string {
  return content.length > EXCERPT_LENGTH ? `${content.slice(0, EXCERPT_LENGTH)}…` : content;
}

/**
 * Écran d'apprenant (pas d'admin) : les notes personnelles écrites par le
 * compte connecté sur des fiches encore publiées.
 *
 * Comme `/favoris`, la garde est `GET /me` (401 → `/login`), pas
 * `useSession()`. Le contenu vient toujours de `GET /notes`, jamais d'un
 * champ sur `GET /entries/:slug`.
 */
export function NotesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const { data, error, setData } = useAsyncData<NotesState>(
    async () => {
      const me = await getMe();
      return me === 'unauthorized' ? 'unauthorized' : listNotes({ page });
    },
    [page],
    'Impossible de charger les notes',
  );

  useEffect(() => {
    if (data === 'unauthorized') {
      navigate('/login', { replace: true });
    }
  }, [data, navigate]);

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  }

  async function onRemove(entryId: string) {
    if (!data || data === 'unauthorized' || removingId) return;

    setRemovingId(entryId);
    setRemoveError(null);

    try {
      const result = await deleteNote(entryId);

      if (result === 'unauthorized') {
        navigate('/login', { replace: true });
        return;
      }

      setData({
        ...data,
        items: data.items.filter((note) => note.entry.id !== entryId),
        total: Math.max(0, data.total - 1),
      });
    } catch (caught) {
      setRemoveError(
        caught instanceof Error ? caught.message : 'Impossible de supprimer cette note',
      );
    } finally {
      setRemovingId(null);
    }
  }

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (data === undefined || data === 'unauthorized') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Notes" description="Notes personnelles écrites sur des fiches publiées." />

      {removeError ? <ErrorMessage>{removeError}</ErrorMessage> : null}

      {data.items.length === 0 ? (
        <EmptyMessage>Aucune note pour le moment.</EmptyMessage>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.items.map((note) => (
              <li key={note.id} className="flex flex-col gap-2">
                <EntryCard entry={note.entry} />
                <p className="text-muted text-sm">{excerpt(note.content)}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isDisabled={removingId === note.entry.id}
                  onPress={() => {
                    void onRemove(note.entry.id);
                  }}
                >
                  Supprimer la note
                </Button>
              </li>
            ))}
          </ul>
          {data.total > data.limit ? (
            <div className="text-muted mt-6 flex items-center gap-3 text-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={page <= 1}
                onPress={() => goToPage(page - 1)}
              >
                Précédent
              </Button>
              <span>
                Page {page} · {data.total} au total
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={page * data.limit >= data.total}
                onPress={() => goToPage(page + 1)}
              >
                Suivant
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
