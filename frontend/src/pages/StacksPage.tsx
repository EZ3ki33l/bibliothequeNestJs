import { Skeleton } from '@heroui/react';
import { StackIcon } from '@phosphor-icons/react';
import { listStacks } from '../lib/stacks';
import { useAsyncData } from '../lib/useAsyncData';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { CtaLink } from '../components/ui/CtaLink';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { CoverCard } from '../components/ui/CoverCard';
import { PageHeader } from '../components/ui/PageHeader';

export function StacksPage() {
  const { data: stacks, error } = useAsyncData(listStacks, [], 'Impossible de charger les leçons');

  return (
    <>
      <PageHeader
        title="Leçons"
        description="Les leçons et leurs fiches publiées, classées par catégorie."
        action={<CtaLink to="/parcours">Suivre un parcours guidé</CtaLink>}
      />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : stacks === undefined ? (
        <div className="card-grid grid gap-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-60 rounded-3xl" />
          ))}
        </div>
      ) : stacks.length === 0 ? (
        <EmptyMessage icon={StackIcon}>Aucune leçon pour le moment.</EmptyMessage>
      ) : (
        <ul className="card-grid grid gap-4">
          {stacks.map((stack) => (
            <li key={stack.id}>
              <CoverCard
                to={`/stacks/${stack.slug}`}
                icon={StackIcon}
                title={stack.name}
                description={stack.description}
                meta={
                  <>
                    {stack._count.categories}{' '}
                    {stack._count.categories > 1 ? 'catégories' : 'catégorie'}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
