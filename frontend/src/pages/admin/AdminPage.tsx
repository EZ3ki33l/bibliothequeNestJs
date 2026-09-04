import { Link } from 'react-router';
import { Card, Skeleton } from '@heroui/react';
import { ArticleIcon, FoldersIcon, StackIcon } from '@phosphor-icons/react';
import { getAdminDashboardCounts } from '../../lib/admin';
import { useAsyncData } from '../../lib/useAsyncData';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

/** Les trois raccourcis du tableau de bord. `key` pointe vers son compteur. */
const CARDS = [
  { to: '/admin/stacks', label: 'Stacks', key: 'stacks' as const, icon: StackIcon },
  { to: '/admin/categories', label: 'Catégories', key: 'categories' as const, icon: FoldersIcon },
  { to: '/admin/entries', label: 'Fiches', key: 'entries' as const, icon: ArticleIcon },
];

export function AdminPage() {
  const { data: counts, error } = useAsyncData(
    getAdminDashboardCounts,
    [],
    'Impossible de charger le tableau de bord',
  );

  return (
    <>
      <PageHeader title="Dashboard" description="Gère les stacks, les catégories et les fiches." />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : counts === undefined ? (
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
