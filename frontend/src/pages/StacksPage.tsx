import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listStacks, type StackListItem } from '../lib/stacks';

export function StacksPage() {
  const [stacks, setStacks] = useState<StackListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listStacks()
      .then((data) => {
        if (!cancelled) setStacks(data);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les stacks');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p>{error}</p>;
  if (stacks === null) return <p>Chargement…</p>;

  return (
    <main>
      <h1>Stacks</h1>
      <p>Parcours les stacks et leurs fiches publiées.</p>

      {stacks.length === 0 ? (
        <p>Aucun stack pour le moment.</p>
      ) : (
        <ul>
          {stacks.map((stack) => (
            <li key={stack.id}>
              <Link to={`/stacks/${stack.slug}`}>
                <p>{stack.name}</p>
                {stack.description ? <p>{stack.description}</p> : null}
                <p>
                  {stack._count.categories}{' '}
                  {stack._count.categories > 1 ? 'catégories' : 'catégorie'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
