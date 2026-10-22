import { useParams } from 'react-router';
import { Skeleton } from '@heroui/react';
import { getCategoryBySlugs } from '../lib/stacks';
import { useAsyncData } from '../lib/useAsyncData';
import { useEntryStates } from '../lib/useEntryStates';
import { useAccessMentions } from '../lib/entryAccess';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { CtaLink } from '../components/ui/CtaLink';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { EntryCard } from '../components/ui/EntryCard';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { NotFoundState } from '../components/ui/NotFoundState';
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

  // Repères du compte connecté (lue, examen réussi, favori) ; `undefined` pour
  // un visiteur ou en cas d'échec.
  const entryIds = category?.entries.map((entry) => entry.id) ?? [];
  const states = useEntryStates(entryIds);
  // Mention des fiches réservées, par une lecture publique d'accès.
  const accessOf = useAccessMentions(entryIds);

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
    return (
      <NotFoundState
        message="Catégorie introuvable."
        listLink={{ to: '/stacks', label: 'Toutes les leçons' }}
      />
    );
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Leçons', to: '/stacks' },
          { label: category.stack.name, to: `/stacks/${category.stack.slug}` },
          { label: category.name },
        ]}
      />
      <PageHeader
        title={category.name}
        description={category.description || undefined}
        action={
          category.entries[0] ? (
            <CtaLink to={`/entries/${category.entries[0].slug}`}>Lire la première fiche</CtaLink>
          ) : null
        }
      />

      {category.entries.length === 0 ? (
        <EmptyMessage>Aucune fiche publiée.</EmptyMessage>
      ) : (
        <ul className="card-grid grid gap-4">
          {category.entries.map((entry) => (
            <li key={entry.id}>
              <EntryCard
                entry={entry}
                state={states?.byEntryId.get(entry.id)}
                access={accessOf(entry.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
