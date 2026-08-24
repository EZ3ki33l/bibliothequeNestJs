import { useNavigate } from 'react-router';
import { AdminStackForm } from './AdminStackForm';

export function AdminStackNewPage() {
  const navigate = useNavigate();

  return (
    <main>
      <h1>Nouveau stack</h1>
      <AdminStackForm mode="create" onSuccess={() => navigate('/admin/stacks')} />
    </main>
  );
}
