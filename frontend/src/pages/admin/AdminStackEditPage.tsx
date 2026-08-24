import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getAdminStackById, type AdminStackDetail } from '../../lib/admin';
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

  if (error) return <p>{error}</p>;
  if (stack === undefined) return <p>Chargement…</p>;
  if (stack === null) return <p>Ce stack n’existe pas.</p>;

  return (
    <main>
      <h1>Modifier {stack.name}</h1>
      <AdminStackForm
        mode="edit"
        stackId={stack.id}
        initialName={stack.name}
        initialDescription={stack.description}
        onSuccess={() => navigate('/admin/stacks')}
      />
    </main>
  );
}
