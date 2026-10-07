import { Link, useLocation, useParams } from 'react-router';
import { Chip, Skeleton, buttonVariants } from '@heroui/react';
import { CheckCircleIcon } from '@phosphor-icons/react';
import {
  entryHrefFromPath,
  getLearningPath,
  getPathProgress,
  type PathDetail,
  type PathProgress,
  type PathStep,
} from '../lib/learningPaths';
import { useAsyncData } from '../lib/useAsyncData';
import { useAccessMentions } from '../lib/entryAccess';
import { currentReturnTo, loginHref, registerHref } from '../lib/returnTo';
import { useViewerAccess } from '../lib/viewerAccess';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { EntryMarkers } from '../components/ui/EntryMarkers';
import { EntryMeta } from '../components/ui/EntryMeta';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { NotFoundState } from '../components/ui/NotFoundState';
import { PageHeader } from '../components/ui/PageHeader';

/**
 * Progression telle que la page l'affiche :
 * - un objet : compte connecté, indicateurs affichés ;
 * - `null` : visiteur (401), invitation à se connecter ;
 * - `'unavailable'` : la progression n'a pas pu être chargée. Le parcours reste
 *   lisible, sans indicateurs ni invitation (la personne est peut-être connectée).
 */
type ProgressState = PathProgress | null | 'unavailable';

type PathPageData = { path: PathDetail | null; progress: ProgressState };

/**
 * Plan d'un parcours : modules puis étapes, dans l'ordre conseillé.
 *
 * Aucune étape n'est verrouillée : l'ordre est une recommandation, pas une
 * contrainte. Quelqu'un qui connaît déjà une notion peut ouvrir directement
 * l'étape suivante — réussir son examen suffit à la valider.
 *
 * Le plan (public) et la progression (sous session) viennent de deux routes
 * distinctes, chargées en parallèle. Un 401 sur la progression n'est pas une
 * erreur : il signifie simplement « visiteur ».
 *
 * Le premier module se lit sans compte ; les fiches des modules suivants sont
 * réservées à un compte dont l'adresse est vérifiée. Leurs étapes restent
 * affichées et cliquables : chacune porte une mention (« Compte requis »,
 * « Adresse à vérifier »), obtenue par une troisième lecture, publique elle
 * aussi. Ces mentions annoncent la règle ; c'est le serveur qui l'applique à
 * l'ouverture de la fiche.
 */
export function PathPage() {
  const { slug } = useParams();
  const location = useLocation();

  const { data, error } = useAsyncData<PathPageData>(
    async () => {
      if (!slug) return { path: null, progress: null };

      const [path, progress] = await Promise.all([
        getLearningPath(slug),
        getPathProgress(slug).catch((): ProgressState => 'unavailable'),
      ]);
      return { path, progress };
    },
    [slug],
    'Impossible de charger le parcours',
  );

  const viewer = useViewerAccess();
  // Mention des étapes dont la fiche est réservée. Rien n'est demandé pour un
  // compte vérifié, qui lit tout.
  const accessOf = useAccessMentions(
    data?.path?.modules.flatMap((module) => module.steps.map((step) => step.entry.id)) ?? [],
  );

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3 rounded-lg" />
        <Skeleton className="h-5 w-1/2 rounded-lg" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const { path } = data;

  if (path === null) {
    return (
      <NotFoundState
        message="Parcours introuvable."
        listLink={{ to: '/parcours', label: 'Tous les parcours' }}
      />
    );
  }

  const progress = data.progress === 'unavailable' ? undefined : data.progress;
  const validated = new Set(progress?.validatedStepIds ?? []);
  const nextStepId = progress?.nextStepId ?? null;

  // Numérotation continue d'un module à l'autre : « étape 5 » reste lisible
  // même quand le module 2 commence. `offsets[i]` = nombre d'étapes avant le
  // module i, calculé une fois plutôt qu'avec un compteur modifié pendant le
  // rendu (React peut rendre un composant plusieurs fois).
  const offsets = path.modules.map((_, index) =>
    path.modules.slice(0, index).reduce((sum, module) => sum + module.steps.length, 0),
  );

  return (
    <>
      <Breadcrumbs items={[{ label: 'Parcours', to: '/parcours' }, { label: path.name }]} />
      <PageHeader title={path.name} description={path.description || undefined} />

      {path.modules.length === 0 ? (
        <EmptyMessage>
          Ce parcours est en préparation : aucune étape n’est encore publiée.
        </EmptyMessage>
      ) : (
        <>
          {progress ? (
            <ProgressSummary path={path} progress={progress} />
          ) : progress === null ? (
            <p className="border-border text-muted mb-8 rounded-xl border border-dashed px-4 py-3 text-sm">
              Le premier module se lit sans compte. Un compte dont l’adresse est vérifiée ouvre les
              modules suivants et le suivi de la progression.{' '}
              {/* L'inscription et la connexion ramènent à ce parcours, pas à
                  l'accueil. */}
              <Link
                to={registerHref(currentReturnTo(location))}
                className="text-foreground underline"
              >
                Créer un compte
              </Link>{' '}
              ou{' '}
              <Link to={loginHref(currentReturnTo(location))} className="text-foreground underline">
                se connecter
              </Link>
              .
            </p>
          ) : null}

          {/* Compte connecté dont l'adresse reste à vérifier : dire pourquoi
              les modules suivants portent une mention, et où agir. */}
          {viewer === 'unverified' && progress !== null ? (
            <p className="border-border text-muted mb-8 rounded-xl border border-dashed px-4 py-3 text-sm">
              L’adresse du compte reste à vérifier : seul le premier module se lit pour le moment.
              Le message de vérification se demande depuis{' '}
              <Link to="/compte" className="text-foreground underline">
                Mon compte
              </Link>
              .
            </p>
          ) : null}

          <ol className="flex flex-col gap-10">
            {path.modules.map((module, moduleIndex) => {
              const moduleProgress = progress?.modules.find((m) => m.moduleId === module.id);

              return (
                <li key={module.id}>
                  <section aria-labelledby={`module-${module.id}`}>
                    <header className="mb-4">
                      <p className="text-muted text-xs tracking-wide uppercase">
                        Module {moduleIndex + 1}
                        {moduleProgress && moduleProgress.required > 0
                          ? ` · ${moduleProgress.validatedRequired}/${moduleProgress.required} validées`
                          : null}
                      </p>
                      <h2 id={`module-${module.id}`} className="text-lg font-semibold">
                        {module.title}
                      </h2>
                      {module.description ? (
                        <p className="text-muted mt-1 text-sm">{module.description}</p>
                      ) : null}
                    </header>
                    <ol className="flex flex-col gap-3">
                      {module.steps.map((step, stepIndex) => (
                        <li key={step.id}>
                          <StepRow
                            step={step}
                            number={offsets[moduleIndex] + stepIndex + 1}
                            pathSlug={path.slug}
                            isValidated={validated.has(step.id)}
                            isNext={step.id === nextStepId}
                            access={accessOf(step.entry.id)}
                          />
                        </li>
                      ))}
                    </ol>
                  </section>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
}

/**
 * Bandeau de progression : compteur global, barre, et accès direct à la
 * prochaine étape conseillée (ou mention « terminé »).
 *
 * Un parcours sans étape obligatoire (que des facultatives) n'a rien à
 * mesurer : aucun bandeau.
 */
function ProgressSummary({ path, progress }: { path: PathDetail; progress: PathProgress }) {
  if (progress.required === 0) return null;

  const percent = Math.round((progress.validatedRequired / progress.required) * 100);
  const nextStep = path.modules
    .flatMap((module) => module.steps)
    .find((step) => step.id === progress.nextStepId);

  return (
    <section
      aria-label="Progression dans le parcours"
      className="border-border bg-surface mb-10 flex flex-col gap-4 rounded-xl border p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          {progress.validatedRequired}{' '}
          {progress.validatedRequired > 1 ? 'étapes validées' : 'étape validée'} sur{' '}
          {progress.required}
        </p>
        {progress.completed ? (
          <Chip size="sm" variant="soft" color="success">
            Parcours terminé
          </Chip>
        ) : (
          <span className="text-muted text-xs">{percent} %</span>
        )}
      </div>

      <div
        role="progressbar"
        aria-label="Étapes obligatoires validées"
        aria-valuemin={0}
        aria-valuemax={progress.required}
        aria-valuenow={progress.validatedRequired}
        className="bg-background h-2 overflow-hidden rounded-full"
      >
        <div className="bg-brand h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>

      {nextStep ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={entryHrefFromPath(nextStep.entry.slug, path.slug)}
            className={`${buttonVariants({ variant: 'primary', size: 'sm' })} no-underline`}
          >
            Continuer : {nextStep.entry.title}
          </Link>
          <span className="text-muted text-xs">
            {/* Seuil fourni par le serveur : celui qui valide réellement. */}
            Une étape est validée par un examen réussi ({progress.passingScore} / 100 ou plus).
          </span>
        </div>
      ) : null}
    </section>
  );
}

type StepRowProps = {
  step: PathStep;
  number: number;
  pathSlug: string;
  isValidated: boolean;
  /** Prochaine étape conseillée : mise en avant, sans bloquer les autres. */
  isNext: boolean;
  /** Mention d'accès de la fiche, si elle est réservée pour ce lecteur. */
  access?: string;
};

/**
 * Une étape : numéro (ou coche si validée), fiche, provenance
 * (stack › catégorie). La provenance compte ici : un même parcours enchaîne
 * des fiches de stacks différents.
 *
 * Une étape réservée reste un lien : la fiche s'ouvre sur son titre et son
 * résumé. Sa mention (cadenas et libellé) prévient avant le clic.
 */
function StepRow({ step, number, pathSlug, isValidated, isNext, access }: StepRowProps) {
  const { entry } = step;

  return (
    <Link
      to={entryHrefFromPath(entry.slug, pathSlug)}
      aria-current={isNext ? 'step' : undefined}
      className={`hover:bg-surface-hover flex items-start gap-4 rounded-xl border p-4 no-underline transition-colors duration-150 ${
        isNext ? 'border-brand' : 'border-border'
      }`}
    >
      {isValidated ? (
        <CheckCircleIcon
          weight="fill"
          aria-label="Étape validée"
          className="text-success size-8 shrink-0"
        />
      ) : (
        <span
          aria-hidden="true"
          className="bg-surface text-muted flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium"
        >
          {number}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-foreground font-medium">{entry.title}</span>
        {entry.summary ? (
          <span className="text-muted line-clamp-2 text-sm">{entry.summary}</span>
        ) : null}
        <span className="text-muted text-xs">
          {entry.category.stack.name} › {entry.category.name}
        </span>
        <span className="mt-1 flex flex-wrap gap-2">
          <EntryMeta kind={entry.kind} difficulty={entry.difficulty} />
          <EntryMarkers access={access} />
          {step.optional ? (
            <Chip size="sm" variant="soft">
              Facultative
            </Chip>
          ) : null}
          {isNext ? (
            <Chip size="sm" variant="soft" color="accent">
              Étape conseillée
            </Chip>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
