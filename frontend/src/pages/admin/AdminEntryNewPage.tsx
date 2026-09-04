import { Link, useNavigate } from 'react-router';
import { listAdminCategories } from '../../lib/admin';
import { useAsyncData } from '../../lib/useAsyncData';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminEntryForm } from './AdminEntryForm';

export function AdminEntryNewPage() {
  const navigate = useNavigate();

  // Une fiche doit choisir sa catégorie parente.
  const { data, error } = useAsyncData(
    () => listAdminCategories(1, 50),
    [],
    'Impossible de charger les catégories',
  );

  return (
    <>
      <Breadcrumbs items={[{ label: 'Fiches', to: '/admin/entries' }, { label: 'Nouveau' }]} />
      <PageHeader title="Nouvelle fiche" />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
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
