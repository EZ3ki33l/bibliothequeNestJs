import { Link } from 'react-router';
import { listAllAdminStacks } from '../../lib/admin';
import { useAsyncData } from '../../lib/useAsyncData';
import { useReturnToList } from '../../components/admin/useReturnToList';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminCategoryForm } from './AdminCategoryForm';

export function AdminCategoryNewPage() {
  const returnToList = useReturnToList('/admin/categories');

  // Une catégorie doit choisir son stack parent : la liste **entière** alimente
  // le select du formulaire (une seule page en cacherait une partie).
  const { data, error } = useAsyncData(listAllAdminStacks, [], 'Impossible de charger les leçons');

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
      ) : data.length === 0 ? (
        <EmptyMessage>
          Une catégorie appartient à une leçon : aucune n’existe encore.{' '}
          <Link to="/admin/stacks/new" className="text-foreground underline">
            Nouvelle leçon
          </Link>
        </EmptyMessage>
      ) : (
        <AdminCategoryForm mode="create" stacks={data} onSuccess={returnToList} />
      )}
    </>
  );
}
