import { Link, useSearchParams } from 'react-router';
import { Button, Card, Chip, Skeleton } from '@heroui/react';
import { PathIcon } from '@phosphor-icons/react';
import {
  listLearningPaths,
  listPathProgress,
  type PathProgressSummary,
} from '../lib/learningPaths';
import { useAsyncData } from '../lib/useAsyncData';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';

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

  return (
    <>
      <PageHeader
        title="Parcours"
        description="Des plans guidés qui ordonnent les fiches pour apprendre un métier, étape par étape."
      />

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyMessage>Aucun parcours publié pour le moment.</EmptyMessage>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.items.map((path) => (
              <li key={path.id}>
                <Link to={`/parcours/${path.slug}`} className="block h-full no-underline">
                  <Card className="hover:bg-surface-hover h-full transition-colors duration-150">
                    <Card.Header>
                      <Card.Title className="flex items-center gap-2">
                        <PathIcon className="text-muted size-4" />
                        {path.name}
                      </Card.Title>
                      {path.description ? (
                        <Card.Description className="line-clamp-3">
                          {path.description}
                        </Card.Description>
                      ) : null}
                    </Card.Header>
                    <Card.Footer className="text-muted flex flex-wrap items-center gap-2 text-xs">
                      <span>
                        {path.stepCount} {path.stepCount > 1 ? 'étapes' : 'étape'}
                      </span>
                      <PathCardProgress progress={data.progressById.get(path.id)} />
                    </Card.Footer>
                  </Card>
                </Link>
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

/**
 * Progression sur une carte, seulement si elle dit quelque chose : un parcours
 * jamais commencé n'affiche rien (« 0 validée » serait du bruit sur chaque carte).
 */
function PathCardProgress({ progress }: { progress: PathProgressSummary | undefined }) {
  if (!progress) return null;

  if (progress.completed) {
    return (
      <Chip size="sm" variant="soft" color="success">
        Terminé
      </Chip>
    );
  }

  if (progress.validatedRequired === 0) return null;

  return (
    <span>
      · {progress.validatedRequired}/{progress.required} validées
    </span>
  );
}
