import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { buttonVariants, toast } from '@heroui/react';
import { FoldersIcon } from '@phosphor-icons/react';
import {
  type AdminCategoriesListPage,
  deleteAdminCategory,
  listAdminCategories,
} from '../../lib/admin';
import { AdminListRow, AdminListSkeleton, AdminPagination } from '../../components/admin/AdminList';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

export function AdminCategoriesPage() {
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<AdminCategoriesListPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminCategories(page)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les catégories');
      });

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken]);

  async function onDelete(categoryId: string) {
    const confirmed = window.confirm('Supprimer cette catégorie et toutes ses fiches ?');

    if (!confirmed) {
      return;
    }

    try {
      await deleteAdminCategory(categoryId);
      toast.success('Catégorie supprimée');
      if (data !== null && data.items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        setReloadToken((token) => token + 1);
      }
    } catch {
      toast.danger('Impossible de supprimer la catégorie');
    }
  }

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
      ) : data === null ? (
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
                onDelete={() => void onDelete(category.id)}
              />
            ))}
          </ul>
          <AdminPagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
