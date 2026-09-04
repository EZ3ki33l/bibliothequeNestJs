import { Link } from 'react-router';
import { buttonVariants } from '@heroui/react';
import { StackIcon } from '@phosphor-icons/react';
import { deleteAdminStack, listAdminStacks } from '../../lib/admin';
import { useAdminResourceList } from '../../components/admin/useAdminResourceList';
import { AdminListRow, AdminListSkeleton, AdminPagination } from '../../components/admin/AdminList';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

export function AdminStacksPage() {
  const { page, setPage, data, error, requestDelete } = useAdminResourceList({
    load: listAdminStacks,
    remove: deleteAdminStack,
    loadError: 'Impossible de charger les stacks',
    confirmMessage: 'Supprimer ce stack et toutes ses catégories / fiches ?',
    deletedMessage: 'Stack supprimé',
    deleteError: 'Impossible de supprimer le stack',
  });

  return (
    <>
      <PageHeader
        title="Stacks"
        description="Techno / contexte (React, Prisma, HeroUI…)."
        action={
          <Link
            to="/admin/stacks/new"
            className={`${buttonVariants({ variant: 'primary' })} no-underline`}
          >
            Nouveau stack
          </Link>
        }
      />

      {/* Ordre des cas : erreur, chargement (`undefined`), liste vide, liste. */}
      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
        <AdminListSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyMessage>
          Aucun stack pour le moment.{' '}
          <Link to="/admin/stacks/new" className="text-foreground underline">
            Créer le premier
          </Link>
        </EmptyMessage>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((stack) => (
              <AdminListRow
                key={stack.id}
                icon={StackIcon}
                title={stack.name}
                subtitle={`${stack.slug} · ${stack._count.categories} ${
                  stack._count.categories > 1 ? 'catégories' : 'catégorie'
                }`}
                editTo={`/admin/stacks/${stack.id}/edit`}
                onDelete={() => void requestDelete(stack.id)}
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
