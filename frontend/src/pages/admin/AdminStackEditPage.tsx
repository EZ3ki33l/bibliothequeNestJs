import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getAdminStackById, type AdminStackDetail } from '../../lib/admin';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminStackForm } from './AdminStackForm';

export function AdminStackEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stack, setStack] = useState<AdminStackDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getAdminStackById(id)
      .then((data) => {
        if (!cancelled) setStack(data);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le stack');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (stack === undefined) return <AdminFormSkeleton />;
  if (stack === null) return <EmptyMessage>Ce stack n’existe pas.</EmptyMessage>;

  return (
    <>
      <Breadcrumbs items={[{ label: 'Stacks', to: '/admin/stacks' }, { label: stack.name }]} />
      <PageHeader title={`Modifier ${stack.name}`} />
      <AdminStackForm
        mode="edit"
        stackId={stack.id}
        initialName={stack.name}
        initialDescription={stack.description}
        onSuccess={() => navigate('/admin/stacks')}
      />
    </>
  );
}
