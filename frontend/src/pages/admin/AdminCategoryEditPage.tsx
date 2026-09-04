import { useNavigate, useParams } from 'react-router';
import { getAdminCategoryById } from '../../lib/admin';
import { useAsyncData } from '../../lib/useAsyncData';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminCategoryForm } from './AdminCategoryForm';

export function AdminCategoryEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: category, error } = useAsyncData(
    () => (id ? getAdminCategoryById(id) : Promise.resolve(null)),
    [id],
    'Impossible de charger la catégorie',
  );

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (category === undefined) return <AdminFormSkeleton />;
  if (category === null) return <EmptyMessage>Cette catégorie n’existe pas.</EmptyMessage>;

  return (
    <>
      <Breadcrumbs
        items={[{ label: 'Catégories', to: '/admin/categories' }, { label: category.name }]}
      />
      <PageHeader title={`Modifier ${category.name}`} />
      <AdminCategoryForm
        mode="edit"
        categoryId={category.id}
        stackName={category.stack.name}
        initialName={category.name}
        initialDescription={category.description}
        onSuccess={() => navigate('/admin/categories')}
      />
    </>
  );
}
