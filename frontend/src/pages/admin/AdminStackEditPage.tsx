import { useNavigate, useParams } from 'react-router';
import { getAdminStackById } from '../../lib/admin';
import { useAsyncData } from '../../lib/useAsyncData';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminStackForm } from './AdminStackForm';

export function AdminStackEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // `id` vient de l'URL, donc typé `string | undefined` : sans id, il n'y a
  // rien à charger et l'écran affiche « n'existe pas ».
  const { data: stack, error } = useAsyncData(
    () => (id ? getAdminStackById(id) : Promise.resolve(null)),
    [id],
    'Impossible de charger le stack',
  );

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
