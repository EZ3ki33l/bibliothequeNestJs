import { Link, useNavigate } from 'react-router';
import { listAdminStacks } from '../../lib/admin';
import { useAsyncData } from '../../lib/useAsyncData';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminCategoryForm } from './AdminCategoryForm';

export function AdminCategoryNewPage() {
  const navigate = useNavigate();

  // Une catégorie doit choisir son stack parent : on charge la liste pour
  // alimenter le select du formulaire.
  const { data, error } = useAsyncData(
    () => listAdminStacks(1, 50),
    [],
    'Impossible de charger les stacks',
  );

  return (
    <>
      <Breadcrumbs
        items={[{ label: 'Catégories', to: '/admin/categories' }, { label: 'Nouveau' }]}
      />
      <PageHeader title="Nouvelle catégorie" />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
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
