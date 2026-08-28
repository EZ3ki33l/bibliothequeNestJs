import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { listAdminCategories, type AdminCategoriesListPage } from '../../lib/admin';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminEntryForm } from './AdminEntryForm';

export function AdminEntryNewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminCategoriesListPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listAdminCategories(1, 50)
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
  }, []);

  return (
    <>
      <Breadcrumbs items={[{ label: 'Fiches', to: '/admin/entries' }, { label: 'Nouveau' }]} />
      <PageHeader title="Nouvelle fiche" />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === null ? (
        <AdminFormSkeleton />
      ) : data.total === 0 ? (
        <EmptyMessage>
          Crée d’abord une catégorie.{' '}
          <Link to="/admin/categories/new" className="text-foreground underline">
            Nouvelle catégorie
          </Link>
        </EmptyMessage>
      ) : (
        <AdminEntryForm
          mode="create"
          categories={data.items}
          onSuccess={() => navigate('/admin/entries')}
        />
      )}
    </>
  );
}
