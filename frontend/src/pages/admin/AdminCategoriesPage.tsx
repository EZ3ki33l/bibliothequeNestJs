import { Link } from 'react-router';
import { buttonVariants } from '@heroui/react';
import { FoldersIcon } from '@phosphor-icons/react';
import { deleteAdminCategory, listAdminCategories } from '../../lib/admin';
import { useAdminResourceList } from '../../components/admin/useAdminResourceList';
import { AdminListRow, AdminListSkeleton, AdminPagination } from '../../components/admin/AdminList';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

export function AdminCategoriesPage() {
  const { page, setPage, data, error, requestDelete } = useAdminResourceList({
    load: listAdminCategories,
    remove: deleteAdminCategory,
    loadError: 'Impossible de charger les catégories',
    confirmMessage: 'Supprimer cette catégorie et toutes ses fiches ?',
    deletedMessage: 'Catégorie supprimée',
    deleteError: 'Impossible de supprimer la catégorie',
  });

  return (
    <>
      <PageHeader
        title="Catégories"
        description="Thèmes dans un stack (Hooks, Formulaires…)."
        action={
          <Link
            to="/admin/categories/new"
            className={`${buttonVariants({ variant: 'primary' })} no-underline`}
          >
            Nouvelle catégorie
          </Link>
        }
      />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
        <AdminListSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyMessage>
          Aucune catégorie pour le moment.{' '}
          <Link to="/admin/categories/new" className="text-foreground underline">
            Créer la première
          </Link>
        </EmptyMessage>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((category) => (
              <AdminListRow
                key={category.id}
                icon={FoldersIcon}
                title={category.name}
                subtitle={`${category.stack.name} · ${category._count.entries} ${
                  category._count.entries > 1 ? 'fiches' : 'fiche'
                }`}
                editTo={`/admin/categories/${category.id}/edit`}
                onDelete={() => void requestDelete(category.id)}
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
