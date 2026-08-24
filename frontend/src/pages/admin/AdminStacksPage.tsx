import { useEffect, useState } from 'react';
import { type AdminStacksListPage, listAdminStacks } from '../../lib/admin';
import { Link } from 'react-router';

export function AdminStacksPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminStacksListPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminStacks(page)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les stacks');
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  if (error) return <p>{error}</p>;
  if (data === null) return <p>Chargement ...</p>;

  return (
    <main>
      <h1>Stacks</h1>
      <p>Gère les stacks du catalogue.</p>
      <Link to="/admin/stacks/new">Nouveau stack</Link>
      {data.items.length === 0 ? (
        <p>
          Aucun stack pour le moment. <Link to="/admin/stacks/new">Créer le premier</Link>
        </p>
      ) : (
        <ul>
          {data.items.map((stack) => (
            <li key={stack.id}>
              <p>{stack.name}</p>
              <p>{stack.slug}</p>
              {stack.description ? <p>{stack.description}</p> : null}
              <p>
                {stack._count.categories} {stack._count.categories > 1 ? 'catégories' : 'catégorie'}
              </p>
              <p>
                <Link to={`/admin/stacks/${stack.id}/edit`}>Modifier</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
      {data.total > data.limit ? (
        <p>
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Précédent
          </button>{' '}
          Page {data.page}
          {' · '}
          {data.total} au total{' '}
          <button
            type="button"
            disabled={page * data.limit >= data.total}
            onClick={() => setPage(page + 1)}
          >
            Suivant
          </button>
        </p>
      ) : null}
    </main>
  );
}
