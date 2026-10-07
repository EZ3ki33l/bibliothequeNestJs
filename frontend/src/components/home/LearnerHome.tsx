import { Link } from 'react-router';
import { Alert, Card, Chip, Skeleton, buttonVariants } from '@heroui/react';
import { NotePencilIcon, PathIcon, StackIcon } from '@phosphor-icons/react';
import {
  entryHrefFromPath,
  getStartedPaths,
  listLearningPaths,
  type PathListItem,
  type StartedPaths,
} from '../../lib/learningPaths';
import { authClient } from '../../lib/auth';
import { useAsyncData } from '../../lib/useAsyncData';
import { viewerAccess } from '../../lib/viewerAccess';
import { VerifyEmailReminder } from '../account/VerifyEmailReminder';
import { HeartIcon } from '../ui/HeartIcon';

/** Nombre de parcours proposés à un compte qui n'en a commencé aucun. */
const SUGGESTED_PATHS = 3;

/**
 * Ce que l'accueil a à proposer :
 * - `resume` : au moins un parcours commencé, à reprendre ;
 * - `start` : aucun, mais des parcours publiés (ou aucun : les leçons seules) ;
 * - `null` : le serveur ne reconnaît pas de session (401), rien de personnel.
 */
type LearnerHomeData =
  { kind: 'resume'; started: StartedPaths } | { kind: 'start'; paths: PathListItem[] } | null;

const SHORTCUT_CLASS =
  'border-border hover:bg-surface-hover text-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-sm no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)';

/**
 * Bloc personnel de l'accueil d'un compte connecté : « Reprendre » un parcours
 * commencé, ou « Par où commencer », puis les raccourcis vers les favoris et
 * les notes.
 *
 * Les parcours commencés viennent d'une lecture **sous session**
 * (`GET /progress/started-paths`), distincte des lectures publiques. Si elle
 * échoue, le bloc s'efface sans message d'erreur : l'accueil garde ses accès
 * d'orientation, rien n'est bloqué.
 *
 * Un compte dont l'adresse reste à vérifier voit d'abord le **rappel** : il ne
 * dépend pas de la lecture des parcours, donc il reste affiché même si elle
 * échoue. `viewerAccess` ne choisit ici que l'affichage du rappel ; ce que le
 * compte peut lire est décidé par le serveur.
 */
export function LearnerHome() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const { data, error } = useAsyncData<LearnerHomeData>(
    async () => {
      const started = await getStartedPaths();

      if (started === null) return null;
      if (started.items.length > 0) return { kind: 'resume', started };

      const paths = await listLearningPaths();
      return { kind: 'start', paths: paths.items.slice(0, SUGGESTED_PATHS) };
    },
    [],
    'Impossible de charger la progression',
  );

  const reminder =
    user && viewerAccess(user) === 'unverified' ? (
      <Alert status="warning" className="mb-8">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Adresse à vérifier</Alert.Title>
          <Alert.Description>
            Le lien reçu par message ouvre tout le catalogue ; d’ici là, le premier module de chaque
            parcours se lit déjà.
          </Alert.Description>
          <div className="mt-3">
            <VerifyEmailReminder email={user.email} returnTo="/" />
          </div>
        </Alert.Content>
      </Alert>
    ) : null;

  // Indisponible, ou session non reconnue : seuls les accès d'orientation de la
  // page restent, comme pour un visiteur. Le rappel, lui, ne dépend pas de
  // cette lecture.
  if (error || data === null) {
    return reminder;
  }

  return (
    <>
      {reminder}
      <section aria-labelledby="learner-home-heading" className="mb-12 flex flex-col gap-4">
        {data === undefined ? (
          // Hauteur proche du contenu final : la page ne saute pas à l'arrivée
          // de la réponse.
          <>
            <Skeleton className="h-7 w-40 rounded-lg" />
            <Skeleton className="h-28 rounded-xl" />
          </>
        ) : data.kind === 'resume' ? (
          <Resume started={data.started} />
        ) : (
          <GetStarted paths={data.paths} />
        )}

        <ul className="flex flex-wrap gap-3" aria-label="Raccourcis du compte">
          <li>
            <Link to="/favoris" className={SHORTCUT_CLASS}>
              <HeartIcon className="text-muted size-4" />
              Favoris
            </Link>
          </li>
          <li>
            <Link to="/notes" className={SHORTCUT_CLASS}>
              <NotePencilIcon aria-hidden="true" className="text-muted size-4" />
              Notes
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}

/** Parcours commencés : progression, et accès direct à la prochaine étape. */
function Resume({ started }: { started: StartedPaths }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="learner-home-heading" className="text-lg font-semibold tracking-tight">
          Reprendre
        </h2>
        <Link to="/parcours" className="text-muted hover:text-foreground text-sm underline">
          Tous les parcours
          {started.total > started.items.length ? ` (${started.total} commencés)` : ''}
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {started.items.map((path) => (
          <li key={path.pathId}>
            <Card className="h-full">
              <Card.Header>
                <Card.Title className="text-base">
                  <Link
                    to={`/parcours/${encodeURIComponent(path.slug)}`}
                    className="text-foreground hover:text-muted no-underline transition-colors duration-150"
                  >
                    {path.name}
                  </Link>
                </Card.Title>
                {path.required > 0 ? (
                  <Card.Description>
                    {path.validatedRequired}{' '}
                    {path.validatedRequired > 1 ? 'étapes validées' : 'étape validée'} sur{' '}
                    {path.required}
                  </Card.Description>
                ) : null}
              </Card.Header>
              <Card.Footer className="flex flex-col items-start gap-3">
                {path.required > 0 ? (
                  <div
                    role="progressbar"
                    aria-label={`Étapes obligatoires validées dans ${path.name}`}
                    aria-valuemin={0}
                    aria-valuemax={path.required}
                    aria-valuenow={path.validatedRequired}
                    className="bg-background h-1.5 w-full overflow-hidden rounded-full"
                  >
                    <div
                      className="bg-brand h-full rounded-full"
                      style={{
                        width: `${Math.round((path.validatedRequired / path.required) * 100)}%`,
                      }}
                    />
                  </div>
                ) : null}
                {path.completed ? (
                  <Chip size="sm" variant="soft" color="success">
                    Terminé
                  </Chip>
                ) : path.nextStep ? (
                  <Link
                    to={entryHrefFromPath(path.nextStep.entrySlug, path.slug)}
                    className={`${buttonVariants({ variant: 'primary', size: 'sm' })} max-w-full no-underline`}
                  >
                    <span className="truncate">Continuer : {path.nextStep.title}</span>
                  </Link>
                ) : (
                  <Link
                    to={`/parcours/${encodeURIComponent(path.slug)}`}
                    className={`${buttonVariants({ variant: 'secondary', size: 'sm' })} no-underline`}
                  >
                    Voir le parcours
                  </Link>
                )}
              </Card.Footer>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Aucun parcours commencé : les parcours publiés, ou à défaut les leçons. */
function GetStarted({ paths }: { paths: PathListItem[] }) {
  return (
    <>
      <h2 id="learner-home-heading" className="text-lg font-semibold tracking-tight">
        Par où commencer
      </h2>
      {paths.length === 0 ? (
        <p className="text-muted text-sm">
          Aucun parcours n’est encore publié : les fiches se trouvent par leçon, dans le catalogue.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map((path) => (
            <li key={path.id}>
              <Link
                to={`/parcours/${encodeURIComponent(path.slug)}`}
                className="block h-full no-underline"
              >
                <Card className="hover:bg-surface-hover h-full transition-colors duration-150">
                  <Card.Header>
                    <Card.Title className="flex items-center gap-2 text-base">
                      <PathIcon aria-hidden="true" className="text-muted size-4 shrink-0" />
                      {path.name}
                    </Card.Title>
                    {path.description ? (
                      <Card.Description className="line-clamp-2">
                        {path.description}
                      </Card.Description>
                    ) : null}
                  </Card.Header>
                  <Card.Footer className="text-muted text-xs">
                    {path.stepCount} {path.stepCount > 1 ? 'étapes' : 'étape'}
                  </Card.Footer>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-3">
        {paths.length > 0 ? (
          <Link
            to="/parcours"
            className={`${buttonVariants({ variant: 'secondary', size: 'sm' })} no-underline`}
          >
            Tous les parcours
          </Link>
        ) : null}
        <Link
          to="/stacks"
          className={`${buttonVariants({ variant: paths.length > 0 ? 'ghost' : 'primary', size: 'sm' })} gap-2 no-underline`}
        >
          <StackIcon aria-hidden="true" className="size-4" />
          Toutes les leçons
        </Link>
      </div>
    </>
  );
}
