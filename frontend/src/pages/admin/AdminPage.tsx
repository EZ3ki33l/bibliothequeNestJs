import { useEffect, useState } from 'react';
import { getAdminDashboardCounts } from '../../lib/admin';
import { Link } from 'react-router';

export function AdminPage() {
  const [counts, setCounts] = useState<{ stacks: number; categories: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getAdminDashboardCounts()
      .then((data) => {
        if (!cancelled) setCounts(data);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le tableau de bord');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p>{error}</p>;
  if (counts === null) return <p>Chargement…</p>;

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Gère les stacks et les catégories.</p>
      <ul>
        <li>
          <Link to="/admin/stacks">
            <p>Stacks</p>
            <p>{counts.stacks}</p>
          </Link>
        </li>
        <li>
          <p>Catégories</p>
          <p>{counts.categories}</p>
        </li>
      </ul>
    </main>
  );
}
