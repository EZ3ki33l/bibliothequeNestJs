import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getAdminCategoryById, type AdminCategoryDetail } from '../../lib/admin';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminCategoryForm } from './AdminCategoryForm';

export function AdminCategoryEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState<AdminCategoryDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getAdminCategoryById(id)
      .then((data) => {
        if (!cancelled) setCategory(data);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger la catégorie');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

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
