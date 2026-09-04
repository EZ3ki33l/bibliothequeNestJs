import { Link, useParams } from 'react-router';
import { Skeleton } from '@heroui/react';
import { getStackBySlug } from '../lib/stacks';
import { useAsyncData } from '../lib/useAsyncData';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { EntryCard } from '../components/ui/EntryCard';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';

export function StackPage() {
  const { slug } = useParams();
  const { data: stack, error } = useAsyncData(
    () => (slug ? getStackBySlug(slug) : Promise.resolve(null)),
    [slug],
    'Impossible de charger le stack',
  );

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (stack === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (stack === null) {
    return <EmptyMessage>Stack introuvable.</EmptyMessage>;
  }

  return (
    <>
      <Breadcrumbs items={[{ label: 'Stacks', to: '/stacks' }, { label: stack.name }]} />
      <PageHeader title={stack.name} description={stack.description || undefined} />

      {stack.categories.length === 0 ? (
        <EmptyMessage>Aucune catégorie dans ce stack.</EmptyMessage>
      ) : (
        <div className="flex flex-col gap-10">
          {stack.categories.map((category) => (
            <section key={category.id}>
              <div className="border-border mb-4 border-b pb-2">
                <h2 className="text-lg font-medium">
                  <Link
                    to={`/stacks/${stack.slug}/${category.slug}`}
                    className="hover:text-muted no-underline transition-colors duration-150"
                  >
                    {category.name}
                  </Link>
                </h2>
                {category.description ? (
                  <p className="text-muted mt-1 text-sm">{category.description}</p>
                ) : null}
              </div>

              {category.entries.length === 0 ? (
                <p className="text-muted/70 text-sm">Aucune fiche publiée.</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {category.entries.map((entry) => (
                    <li key={entry.id}>
                      <EntryCard entry={entry} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
