import { useParams } from 'react-router';
import { Skeleton } from '@heroui/react';
import { getCategoryBySlugs } from '../lib/stacks';
import { useAsyncData } from '../lib/useAsyncData';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { EntryCard } from '../components/ui/EntryCard';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';

export function CategoryPage() {
  // L'URL du navigateur porte les deux slugs : `/stacks/react/hooks`.
  const { stackSlug, categorySlug } = useParams();
  const { data: category, error } = useAsyncData(
    () =>
      stackSlug && categorySlug
        ? getCategoryBySlugs(stackSlug, categorySlug)
        : Promise.resolve(null),
    [stackSlug, categorySlug],
    'Impossible de charger la catégorie',
  );

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (category === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (category === null) {
    return <EmptyMessage>Catégorie introuvable.</EmptyMessage>;
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Stacks', to: '/stacks' },
          { label: category.stack.name, to: `/stacks/${category.stack.slug}` },
          { label: category.name },
        ]}
      />
      <PageHeader title={category.name} description={category.description || undefined} />

      {category.entries.length === 0 ? (
        <EmptyMessage>Aucune fiche publiée.</EmptyMessage>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {category.entries.map((entry) => (
            <li key={entry.id}>
              <EntryCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
