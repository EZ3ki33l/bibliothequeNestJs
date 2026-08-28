import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { listAdminStacks, type AdminStacksListPage } from '../../lib/admin';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminCategoryForm } from './AdminCategoryForm';

export function AdminCategoryNewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminStacksListPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listAdminStacks(1, 50)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les stacks');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Breadcrumbs
        items={[{ label: 'Catégories', to: '/admin/categories' }, { label: 'Nouveau' }]}
      />
      <PageHeader title="Nouvelle catégorie" />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === null ? (
        <AdminFormSkeleton />
      ) : data.total === 0 ? (
        <EmptyMessage>
          Crée d’abord un stack.{' '}
          <Link to="/admin/stacks/new" className="text-foreground underline">
            Nouveau stack
          </Link>
        </EmptyMessage>
      ) : (
        <AdminCategoryForm
          mode="create"
          stacks={data.items}
          onSuccess={() => navigate('/admin/categories')}
        />
      )}
    </>
  );
}
