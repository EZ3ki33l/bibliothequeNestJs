import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Card, Skeleton } from '@heroui/react';
import { StackIcon } from '@phosphor-icons/react';
import { listStacks, type StackListItem } from '../lib/stacks';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';

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

  return (
    <>
      <PageHeader title="Stacks" description="Parcours les stacks et leurs fiches publiées." />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : stacks === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : stacks.length === 0 ? (
        <EmptyMessage>Aucun stack pour le moment.</EmptyMessage>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {stacks.map((stack) => (
            <li key={stack.id}>
              <Link to={`/stacks/${stack.slug}`} className="block h-full no-underline">
                <Card className="hover:bg-surface-hover h-full transition-colors duration-150">
                  <Card.Header>
                    <Card.Title className="flex items-center gap-2">
                      <StackIcon className="text-muted size-4" />
                      {stack.name}
                    </Card.Title>
                    {stack.description ? (
                      <Card.Description>{stack.description}</Card.Description>
                    ) : null}
                  </Card.Header>
                  <Card.Footer className="text-muted text-xs">
                    {stack._count.categories}{' '}
                    {stack._count.categories > 1 ? 'catégories' : 'catégorie'}
                  </Card.Footer>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
