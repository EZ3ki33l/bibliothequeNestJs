import { useState, type SubmitEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, Chip, Input, Label, TextField, buttonVariants, toast } from '@heroui/react';
import { ArticleIcon } from '@phosphor-icons/react';
import {
  deleteAdminEntry,
  getAdminEntryById,
  listAdminEntries,
  listAllAdminCategories,
  listAllAdminPaths,
  listAllAdminStacks,
  setAdminEntryPublished,
  type AdminEntriesFilters,
  type AdminEntryListItem,
} from '../../lib/admin';
import { publicationGaps, publicationQuestion } from '../../lib/entryChecks';
import { KIND_LABEL } from '../../lib/labels';
import { jsonToStringRecord } from '../../lib/stacks';
import { useAsyncData } from '../../lib/useAsyncData';
import { useAdminResourceList } from '../../components/admin/useAdminResourceList';
import { AdminListRow, AdminListSkeleton, AdminPagination } from '../../components/admin/AdminList';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

const STATUS_ITEMS = [
  { id: '', label: 'Tous les états' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'published', label: 'Publiées' },
];

/** Une valeur d'URL inconnue (lien modifié à la main) vaut « pas de filtre ». */
function readStatus(value: string | null): AdminEntriesFilters['status'] {
  return value === 'draft' || value === 'published' ? value : undefined;
}

/** Stacks, catégories et parcours qui alimentent les trois listes de filtres. */
async function loadFilterOptions() {
  const [stacks, categories, paths] = await Promise.all([
    listAllAdminStacks(),
    listAllAdminCategories(),
    listAllAdminPaths(),
  ]);

  return { stacks, categories, paths };
}

/**
 * Liste des fiches de l'administration, brouillons compris.
 *
 * Trois gestes évitent d'ouvrir chaque fiche :
 * - **filtrer** par titre, état, stack, catégorie ou parcours (combinés en ET
 *   par le serveur) ;
 * - **publier ou dépublier** depuis la ligne ;
 * - **dupliquer** : le lien ouvre le formulaire de création prérempli.
 *
 * Filtres et page vivent dans l'URL, pas dans un état React : après
 * l'enregistrement d'une fiche, le retour ramène sur la même liste filtrée.
 */
export function AdminEntriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';
  const status = readStatus(searchParams.get('status'));
  const stackId = searchParams.get('stack') ?? '';
  const categoryId = searchParams.get('category') ?? '';
  const pathId = searchParams.get('path') ?? '';

  const hasFilters =
    q !== '' || status !== undefined || stackId !== '' || categoryId !== '' || pathId !== '';

  // Id de la fiche dont la publication est en cours : un seul envoi à la fois,
  // sinon un double clic publierait puis dépublierait.
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { page, setPage, data, error, reload, reloadAfterRemoval, requestDelete } =
    useAdminResourceList({
      load: (current) =>
        listAdminEntries(current, undefined, { q, status, stackId, categoryId, pathId }),
      remove: deleteAdminEntry,
      loadError: 'Impossible de charger les fiches',
      confirmMessage: (title) =>
        `Supprimer la fiche « ${title} » ? Lectures, quiz, favoris et notes des lecteurs sur cette fiche sont supprimés aussi, et elle est retirée des parcours.`,
      deletedMessage: 'Fiche supprimée',
      deleteError: 'Impossible de supprimer la fiche',
      deps: [q, status, stackId, categoryId, pathId],
    });

  // Une panne ici ne bloque pas la liste : les filtres restent à « Tous ».
  const { data: options } = useAsyncData(
    loadFilterOptions,
    [],
    'Impossible de charger les filtres',
  );

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();

    // Valeur '' = « Tous » : elle n'est pas écrite dans l'URL. Tout nouveau
    // filtrage repart de la page 1 (`next` sans `page`).
    for (const name of ['q', 'status', 'stack', 'category', 'path']) {
      const value = String(form.get(name) ?? '').trim();
      if (value) next.set(name, value);
    }

    setSearchParams(next);
  }

  /**
   * Publie ou dépublie une fiche depuis la liste.
   *
   * La liste ne contient ni le corps ni le résumé : avant une mise en ligne, la
   * fiche est relue auprès du serveur pour poser la même question que le
   * formulaire (`publicationGaps`). Une fiche vide ne part donc pas en ligne
   * sans avertissement, même publiée d'un clic.
   *
   * Comme dans le formulaire, c'est un rappel et non un contrôle : le serveur
   * décide seul qui publie, et son refus (403) s'affiche tel quel.
   */
  async function togglePublished(entry: AdminEntryListItem) {
    if (togglingId !== null) {
      return;
    }

    if (
      entry.published &&
      !window.confirm(
        `Dépublier « ${entry.title} » ? La fiche ne sera plus visible dans le catalogue ni dans les parcours.`,
      )
    ) {
      return;
    }

    setTogglingId(entry.id);

    try {
      if (!entry.published) {
        const detail = await getAdminEntryById(entry.id);
        if (detail === null) {
          toast.danger('Cette fiche n’existe plus.');
          reload();
          return;
        }

        const gaps = publicationGaps({
          summary: detail.summary.trim(),
          bodyMdx: detail.bodyMdx.trim(),
          kind: detail.kind,
          files: jsonToStringRecord(detail.files),
          sourceCount: detail.sources.length,
        });
        if (
          gaps.length > 0 &&
          !window.confirm(`« ${entry.title} »\n\n${publicationQuestion(gaps)}`)
        ) {
          return;
        }
      }

      const result = await setAdminEntryPublished(entry.id, !entry.published);
      if (!result.ok) {
        toast.danger(result.message);
        if (result.status === 404) reload();
        return;
      }

      toast.success(entry.published ? 'Fiche dépubliée' : 'Fiche publiée');

      // Avec un filtre d'état, la fiche ne correspond plus à la liste affichée :
      // elle en sort, comme après une suppression.
      if (status !== undefined) {
        reloadAfterRemoval();
      } else {
        reload();
      }
    } catch {
      toast.danger('Impossible de modifier la fiche');
    } finally {
      setTogglingId(null);
    }
  }

  // `key` force chaque champ à reprendre la valeur de l'URL après navigation ;
  // `ready` le remonte une fois ses options chargées.
  const ready = options === undefined ? 'loading' : 'ready';

  return (
    <>
      <PageHeader
        title="Fiches"
        description="Fiches du catalogue, brouillons inclus."
        action={
          <Link
            to="/admin/entries/new"
            className={`${buttonVariants({ variant: 'primary' })} no-underline`}
          >
            Nouvelle fiche
          </Link>
        }
      />

      <form onSubmit={onSubmit} className="mb-6 flex flex-wrap items-end gap-3">
        <TextField
          name="q"
          className="w-full sm:w-auto sm:min-w-56 sm:flex-1"
          defaultValue={q}
          key={q}
          maxLength={100}
          autoComplete="off"
        >
          <Label>Titre</Label>
          <Input placeholder="ex. useState" />
        </TextField>
        <AdminSelect
          key={`status-${status ?? ''}`}
          name="status"
          label="État"
          items={STATUS_ITEMS}
          defaultValue={status ?? ''}
        />
        <AdminSelect
          key={`stack-${stackId}-${ready}`}
          name="stack"
          label="Leçon"
          items={[
            { id: '', label: 'Toutes les leçons' },
            ...(options?.stacks ?? []).map((stack) => ({ id: stack.id, label: stack.name })),
          ]}
          defaultValue={stackId}
        />
        <AdminSelect
          key={`category-${categoryId}-${ready}`}
          name="category"
          label="Catégorie"
          items={[
            { id: '', label: 'Toutes les catégories' },
            ...(options?.categories ?? []).map((category) => ({
              id: category.id,
              label: `${category.stack.name} / ${category.name}`,
            })),
          ]}
          defaultValue={categoryId}
        />
        <AdminSelect
          key={`path-${pathId}-${ready}`}
          name="path"
          label="Parcours"
          items={[
            { id: '', label: 'Tous les parcours' },
            ...(options?.paths ?? []).map((path) => ({ id: path.id, label: path.name })),
          ]}
          defaultValue={pathId}
        />
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
        {hasFilters ? (
          <Link
            to="/admin/entries"
            className={`${buttonVariants({ variant: 'ghost' })} no-underline`}
          >
            Réinitialiser
          </Link>
        ) : null}
      </form>

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
        <AdminListSkeleton />
      ) : data.items.length === 0 ? (
        hasFilters ? (
          <EmptyMessage>Aucune fiche ne correspond à ces filtres.</EmptyMessage>
        ) : (
          <EmptyMessage>
            Aucune fiche pour le moment.{' '}
            <Link to="/admin/entries/new" className="text-foreground underline">
              Créer la première
            </Link>
          </EmptyMessage>
        )
      ) : (
        <>
          <p className="text-muted mb-3 text-sm">
            {data.total} {data.total > 1 ? 'fiches' : 'fiche'}
          </p>
          <ul className="flex flex-col gap-2">
            {data.items.map((entry) => (
              <AdminListRow
                key={entry.id}
                icon={ArticleIcon}
                title={entry.title}
                subtitle={`${entry.category.stack.name} · ${entry.category.name} · ${KIND_LABEL[entry.kind]}`}
                actions={
                  <>
                    <Chip size="sm" variant="soft" color={entry.published ? 'success' : 'warning'}>
                      {entry.published ? 'Publiée' : 'Brouillon'}
                    </Chip>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      isDisabled={togglingId !== null}
                      onPress={() => void togglePublished(entry)}
                    >
                      {entry.published ? 'Dépublier' : 'Publier'}
                    </Button>
                    <Link
                      to={`/admin/entries/new?from=${entry.id}`}
                      className="text-muted hover:text-foreground text-sm no-underline transition-colors duration-150"
                    >
                      Dupliquer
                    </Link>
                  </>
                }
                editTo={`/admin/entries/${entry.id}/edit`}
                onDelete={() => void requestDelete(entry.id, entry.title)}
              />
            ))}
          </ul>
          <AdminPagination
            page={page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
