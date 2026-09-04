import { Link } from 'react-router';
import { buttonVariants } from '@heroui/react';
import { ArticleIcon } from '@phosphor-icons/react';
import { deleteAdminEntry, listAdminEntries } from '../../lib/admin';
import { KIND_LABEL } from '../../lib/labels';
import { useAdminResourceList } from '../../components/admin/useAdminResourceList';
import { AdminListRow, AdminListSkeleton, AdminPagination } from '../../components/admin/AdminList';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

export function AdminEntriesPage() {
  const { page, setPage, data, error, requestDelete } = useAdminResourceList({
    load: listAdminEntries,
    remove: deleteAdminEntry,
    loadError: 'Impossible de charger les fiches',
    confirmMessage: 'Supprimer cette fiche et les révisions / quiz liés ?',
    deletedMessage: 'Fiche supprimée',
    deleteError: 'Impossible de supprimer la fiche',
  });

  return (
    <>
      <PageHeader
        title="Fiches"
        description="Gère les fiches du catalogue (brouillons inclus)."
        action={
          <Link
            to="/admin/entries/new"
            className={`${buttonVariants({ variant: 'primary' })} no-underline`}
          >
            Nouvelle fiche
          </Link>
        }
      />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
        <AdminListSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyMessage>
          Aucune fiche pour le moment.{' '}
          <Link to="/admin/entries/new" className="text-foreground underline">
            Créer la première
          </Link>
        </EmptyMessage>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((entry) => (
              <AdminListRow
                key={entry.id}
                icon={ArticleIcon}
                title={entry.title}
                subtitle={`${entry.category.stack.name} · ${entry.category.name} · ${KIND_LABEL[entry.kind]} · ${
                  entry.published ? 'publié' : 'brouillon'
                }`}
                editTo={`/admin/entries/${entry.id}/edit`}
                onDelete={() => void requestDelete(entry.id)}
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
