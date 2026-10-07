import { useReturnToList } from '../../components/admin/useReturnToList';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { PageHeader } from '../../components/ui/PageHeader';
import { AdminStackForm } from './AdminStackForm';

export function AdminStackNewPage() {
  const returnToList = useReturnToList('/admin/stacks');

  return (
    <>
      <Breadcrumbs items={[{ label: 'Leçons', to: '/admin/stacks' }, { label: 'Nouvelle' }]} />
      <PageHeader title="Nouvelle leçon" />
      <AdminStackForm mode="create" onSuccess={returnToList} />
    </>
  );
}
