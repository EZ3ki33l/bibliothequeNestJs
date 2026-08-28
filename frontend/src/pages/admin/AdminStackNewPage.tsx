import { useNavigate } from 'react-router';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminStackForm } from './AdminStackForm';

export function AdminStackNewPage() {
  const navigate = useNavigate();

  return (
    <>
      <Breadcrumbs items={[{ label: 'Stacks', to: '/admin/stacks' }, { label: 'Nouveau' }]} />
      <PageHeader title="Nouveau stack" />
      <AdminStackForm mode="create" onSuccess={() => navigate('/admin/stacks')} />
    </>
  );
}
