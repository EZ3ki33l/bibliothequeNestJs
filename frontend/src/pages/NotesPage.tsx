import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button, Skeleton } from '@heroui/react';
import { getMe } from '../lib/auth';
import { deleteNote, listNotes, saveNote, type NotesPage as NotesPageData } from '../lib/notes';
import { useAsyncData } from '../lib/useAsyncData';
import { useLoginRedirect } from '../lib/useLoginRedirect';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { NoteCard } from '../components/notes/NoteCard';
import { useAccessMentions } from '../lib/entryAccess';
import { PageHeader } from '../components/ui/PageHeader';

/** `'unauthorized'` : session absente, la redirection est en cours. */
type NotesState = NotesPageData | 'unauthorized';

/** Dernier échec d'écriture, rattaché à la note concernée. */
type NoteFailure = { entryId: string; message: string };

/**
 * Écran d'apprenant (pas d'admin) : les notes personnelles écrites par le
 * compte connecté sur des fiches encore publiées. Chaque note s'y lit en
 * entier et s'y corrige sur place.
 *
 * Comme `/favoris`, la garde est `GET /me` (401 → connexion, en retenant cette
 * page), pas `useSession()`. Le contenu vient toujours de `GET /notes`, jamais
 * d'un champ sur `GET /entries/:slug`.
 *
 * L'enregistrement passe par la route de la fiche (`PUT /notes/:entryId`) : le
 * serveur lit le compte dans la session, et refuse un texte trop long.
 */
export function NotesPage() {
  const redirectToLogin = useLoginRedirect();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  // Une seule note en modification à la fois : en ouvrir une autre demande
  // d'abord d'enregistrer ou d'annuler.
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  // `entryId` de la note en cours d'écriture (enregistrement ou suppression).
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [failure, setFailure] = useState<NoteFailure | null>(null);

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
      redirectToLogin();
    }
  }, [data, redirectToLogin]);

  // Une note prise sur une fiche en accès libre, refermée depuis, reste lisible
  // ici : seule la carte de la fiche porte la mention « Adresse à vérifier ».
  const accessOf = useAccessMentions(
    data && data !== 'unauthorized' ? data.items.map((note) => note.entry.id) : [],
  );

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setEditingEntryId(null);
    setFailure(null);
    setSearchParams(next);
  }

  /** Retire la note de la liste affichée, sans redemander la page. */
  function dropFromList(current: NotesPageData, entryId: string) {
    setData({
      ...current,
      items: current.items.filter((note) => note.entry.id !== entryId),
      total: Math.max(0, current.total - 1),
    });
  }

  /**
   * Enregistre la note modifiée, puis met la liste à jour sur place.
   *
   * En cas d'échec (texte refusé, réseau), la note **reste en modification** :
   * la saisie est conservée à l'écran, avec le message.
   */
  async function onSave(entryId: string, content: string) {
    if (!data || data === 'unauthorized' || pendingEntryId) return;

    setPendingEntryId(entryId);
    setFailure(null);

    try {
      const saved = await saveNote(entryId, content);

      if (saved === 'unauthorized') {
        redirectToLogin();
        return;
      }

      if (saved === null) {
        // Texte vidé : le serveur a supprimé la note, comme sur la fiche.
        dropFromList(data, entryId);
      } else {
        setData({
          ...data,
          items: data.items.map((note) =>
            note.entry.id === entryId
              ? { ...note, content: saved.content, updatedAt: saved.updatedAt }
              : note,
          ),
        });
      }

      setEditingEntryId(null);
    } catch (caught) {
      setFailure({
        entryId,
        message: caught instanceof Error ? caught.message : 'Impossible d’enregistrer cette note',
      });
    } finally {
      setPendingEntryId(null);
    }
  }

  async function onRemove(entryId: string, entryTitle: string) {
    if (!data || data === 'unauthorized' || pendingEntryId) return;

    // Une note supprimée ne se récupère pas : la confirmation nomme la fiche.
    if (
      !window.confirm(
        `Supprimer la note sur « ${entryTitle} » ? Elle ne pourra pas être récupérée.`,
      )
    ) {
      return;
    }

    setPendingEntryId(entryId);
    setFailure(null);

    try {
      const result = await deleteNote(entryId);

      if (result === 'unauthorized') {
        redirectToLogin();
        return;
      }

      dropFromList(data, entryId);
    } catch (caught) {
      setFailure({
        entryId,
        message: caught instanceof Error ? caught.message : 'Impossible de supprimer cette note',
      });
    } finally {
      setPendingEntryId(null);
    }
  }

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (data === undefined || data === 'unauthorized') {
    return (
      <div className="card-grid grid gap-6 [--card-min:28rem]">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Notes" description="Notes personnelles écrites sur des fiches publiées." />

      {data.items.length === 0 ? (
        <EmptyMessage>
          Aucune note pour le moment. Une note s’écrit en bas d’une fiche, puis se retrouve ici.
        </EmptyMessage>
      ) : (
        <>
          <ul className="card-grid grid items-start gap-8 [--card-min:28rem]">
            {data.items.map((note) => (
              <li key={note.id}>
                <NoteCard
                  note={note}
                  access={accessOf(note.entry.id)}
                  editing={editingEntryId === note.entry.id}
                  editDisabled={editingEntryId !== null && editingEntryId !== note.entry.id}
                  pending={pendingEntryId === note.entry.id}
                  error={failure?.entryId === note.entry.id ? failure.message : null}
                  onEdit={() => {
                    setFailure(null);
                    setEditingEntryId(note.entry.id);
                  }}
                  onCancel={() => {
                    setFailure(null);
                    setEditingEntryId(null);
                  }}
                  onSave={(content) => {
                    void onSave(note.entry.id, content);
                  }}
                  onRemove={() => {
                    void onRemove(note.entry.id, note.entry.title);
                  }}
                />
              </li>
            ))}
          </ul>
          {data.total > data.limit ? (
            <div className="text-muted mt-6 flex items-center gap-3 text-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={page <= 1 || editingEntryId !== null}
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
                isDisabled={page * data.limit >= data.total || editingEntryId !== null}
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
