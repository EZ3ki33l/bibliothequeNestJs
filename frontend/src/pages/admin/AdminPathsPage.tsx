import { Link } from 'react-router';
import { buttonVariants } from '@heroui/react';
import { PathIcon } from '@phosphor-icons/react';
import { deleteAdminPath, listAdminPaths } from '../../lib/admin';
import { useAdminResourceList } from '../../components/admin/useAdminResourceList';
import { AdminListRow, AdminListSkeleton, AdminPagination } from '../../components/admin/AdminList';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

export function AdminPathsPage() {
  const { page, setPage, data, error, requestDelete } = useAdminResourceList({
    load: listAdminPaths,
    remove: deleteAdminPath,
    loadError: 'Impossible de charger les parcours',
    // La suppression n'emporte que la composition : les fiches restent.
    confirmMessage:
      'Supprimer ce parcours, ses modules et ses étapes ? Les fiches sont conservées.',
    deletedMessage: 'Parcours supprimé',
    deleteError: 'Impossible de supprimer le parcours',
  });

  return (
    <>
      <PageHeader
        title="Parcours"
        description="Plans guidés par métier : modules ordonnés d’étapes, chacune liée à une fiche."
        action={
          <Link
            to="/admin/parcours/new"
            className={`${buttonVariants({ variant: 'primary' })} no-underline`}
          >
            Nouveau parcours
          </Link>
        }
      />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
        <AdminListSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyMessage>
          Aucun parcours pour le moment.{' '}
          <Link to="/admin/parcours/new" className="text-foreground underline">
            Créer le premier
          </Link>
        </EmptyMessage>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((path) => (
              <AdminListRow
                key={path.id}
                icon={PathIcon}
                title={path.name}
                subtitle={[
                  path.published ? 'Publié' : 'Brouillon',
                  plural(path.moduleCount, 'module', 'modules'),
                  plural(path.stepCount, 'étape', 'étapes'),
                ].join(' · ')}
                editTo={`/admin/parcours/${path.id}/edit`}
                onDelete={() => void requestDelete(path.id)}
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
