import { Link, useParams } from 'react-router';
import { Skeleton } from '@heroui/react';
import { getStackBySlug } from '../lib/stacks';
import { useAsyncData } from '../lib/useAsyncData';
import { useEntryStates } from '../lib/useEntryStates';
import { useAccessMentions } from '../lib/entryAccess';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { EntryCard } from '../components/ui/EntryCard';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { NotFoundState } from '../components/ui/NotFoundState';
import { PageHeader } from '../components/ui/PageHeader';
import { Typo } from '../components/ui/Typo';

export function StackPage() {
  const { slug } = useParams();
  const { data: stack, error } = useAsyncData(
    () => (slug ? getStackBySlug(slug) : Promise.resolve(null)),
    [slug],
    'Impossible de charger la leçon',
  );

  // Repères du compte connecté pour toutes les fiches de la leçon, en une
  // lecture sous session. `undefined` pour un visiteur ou en cas d'échec : les
  // cartes s'affichent alors sans repère, la liste reste utilisable.
  const entryIds =
    stack?.categories.flatMap((category) => category.entries.map((entry) => entry.id)) ?? [];
  const states = useEntryStates(entryIds);

  // Mention des fiches réservées (« Compte requis », « Adresse à vérifier ») :
  // lecture publique, séparée de celle de la leçon. Toutes les fiches publiées
  // restent listées ; un compte vérifié ne demande rien et ne voit aucune mention.
  const accessOf = useAccessMentions(entryIds);

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
    return (
      <NotFoundState
        message="Leçon introuvable."
        listLink={{ to: '/stacks', label: 'Toutes les leçons' }}
      />
    );
  }

  return (
    <>
      <Breadcrumbs items={[{ label: 'Leçons', to: '/stacks' }, { label: stack.name }]} />
      <PageHeader title={stack.name} description={stack.description || undefined} />

      {stack.categories.length === 0 ? (
        <EmptyMessage>Aucune catégorie dans cette leçon.</EmptyMessage>
      ) : (
        <div className="flex flex-col gap-10">
          {stack.categories.map((category) => (
            <section key={category.id}>
              <div className="border-border mb-4 border-b pb-2">
                <Typo variant="h3" as="h2">
                  <Link
                    to={`/stacks/${stack.slug}/${category.slug}`}
                    className="hover:text-blueberry-light no-underline transition-colors duration-150"
                  >
                    {category.name}
                  </Link>
                </Typo>
                {category.description ? (
                  <Typo variant="small" as="p" className="mt-1">
                    {category.description}
                  </Typo>
                ) : null}
              </div>

              {category.entries.length === 0 ? (
                <Typo variant="small" as="p" className="text-muted/70">
                  Aucune fiche publiée.
                </Typo>
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
            </section>
          ))}
        </div>
      )}
    </>
  );
}
