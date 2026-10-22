import { useSearchParams } from 'react-router';
import { Button, Skeleton } from '@heroui/react';
import { PathIcon } from '@phosphor-icons/react';
import {
  listLearningPaths,
  listPathProgress,
  type PathProgressSummary,
} from '../lib/learningPaths';
import { useAsyncData } from '../lib/useAsyncData';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { CtaLink } from '../components/ui/CtaLink';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { CoverCard } from '../components/ui/CoverCard';
import { PageHeader } from '../components/ui/PageHeader';
import { PathCardProgress } from '../components/ui/PathCardProgress';

/**
 * Liste publique des parcours guidés. Sans compte : un parcours se lit
 * librement.
 *
 * Avec un compte, la progression de chaque carte vient d'une seconde route
 * (sous session) qui pagine les **mêmes** parcours dans le même ordre : les
 * deux pages se fusionnent par `pathId`. Un 401 (visiteur) ou un échec de
 * cette seconde route laisse simplement les cartes sans progression.
 */
export function PathsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const { data, error } = useAsyncData(
    async () => {
      const [paths, progress] = await Promise.all([
        listLearningPaths(page),
        listPathProgress(page).catch(() => null),
      ]);
      const progressById = new Map<string, PathProgressSummary>(
        (progress?.items ?? []).map((item) => [item.pathId, item]),
      );
      return { ...paths, progressById };
    },
    [page],
    'Impossible de charger les parcours',
  );

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  }

  // Action de l'écran : reprendre le premier parcours entamé de la page, sinon
  // commencer le premier parcours listé.
  const started = data?.items.find((path) => {
    const progress = data.progressById.get(path.id);
    return progress !== undefined && progress.validatedRequired > 0 && !progress.completed;
  });
  const featured = started ?? data?.items[0];

  return (
    <>
      <PageHeader
        title="Parcours"
        description="Des plans guidés qui ordonnent les fiches pour apprendre un métier, étape par étape."
        action={
          featured ? (
            <CtaLink to={`/parcours/${featured.slug}`}>
              {started ? 'Reprendre le parcours' : 'Commencer le premier parcours'}
            </CtaLink>
          ) : null
        }
      />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
        <div className="card-grid grid gap-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-60 rounded-3xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyMessage icon={PathIcon}>Aucun parcours publié pour le moment.</EmptyMessage>
      ) : (
        <>
          <ul className="card-grid grid gap-4">
            {data.items.map((path) => (
              <li key={path.id}>
                <CoverCard
                  to={`/parcours/${path.slug}`}
                  icon={PathIcon}
                  title={path.name}
                  description={path.description}
                  meta={
                    <>
                      {path.subPathCount > 0 ? (
                        <span>{path.subPathCount} sous-parcours ·</span>
                      ) : null}
                      <span>
                        {path.stepCount} {path.stepCount > 1 ? 'étapes' : 'étape'}
                      </span>
                      <PathCardProgress progress={data.progressById.get(path.id)} />
                    </>
                  }
                />
              </li>
            ))}
          </ul>
          {data.total > data.limit ? (
            <div className="text-muted mt-6 flex items-center gap-3 text-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={page <= 1}
                onPress={() => goToPage(page - 1)}
              >
                Précédent
              </Button>
              <span>
                Page {page} · {data.total} au total
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={page * data.limit >= data.total}
                onPress={() => goToPage(page + 1)}
              >
                Suivant
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
