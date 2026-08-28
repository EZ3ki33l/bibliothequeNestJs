import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Card, Skeleton } from '@heroui/react';
import { ArticleIcon, FoldersIcon, StackIcon } from '@phosphor-icons/react';
import { getAdminDashboardCounts } from '../../lib/admin';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

const CARDS = [
  { to: '/admin/stacks', label: 'Stacks', key: 'stacks' as const, icon: StackIcon },
  { to: '/admin/categories', label: 'Catégories', key: 'categories' as const, icon: FoldersIcon },
  { to: '/admin/entries', label: 'Fiches', key: 'entries' as const, icon: ArticleIcon },
];

export function AdminPage() {
  const [counts, setCounts] = useState<{
    stacks: number;
    categories: number;
    entries: number;
  } | null>(null);
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

  return (
    <>
      <PageHeader title="Dashboard" description="Gère les stacks, les catégories et les fiches." />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : counts === null ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <li key={card.to}>
                <Link to={card.to} className="block h-full no-underline">
                  <Card className="hover:bg-surface-hover h-full transition-colors duration-150">
                    <Card.Header>
                      <Icon className="text-muted size-4" />
                      <Card.Title>{card.label}</Card.Title>
                      <Card.Description>{counts[card.key]}</Card.Description>
                    </Card.Header>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
