import { Link } from 'react-router';
import { ArrowLeftIcon, ArrowRightIcon, LockIcon } from '@phosphor-icons/react';
import { entryHrefFromPath, type PathEntry } from '../../lib/learningPaths';
import type { AdjacentSteps } from '../../lib/pathSteps';
import { accessMention, type ViewerAccess } from '../../lib/viewerAccess';

type EntryStepNavProps = {
  steps: AdjacentSteps;
  /** Slug du parcours depuis lequel la fiche a été ouverte. */
  pathSlug: string;
  /**
   * Fiches réservées parmi les étapes voisines. `undefined` : inconnu, ou
   * lecteur vérifié ; aucune mention n'est alors affichée.
   */
  reservedIds?: Set<string>;
  /** Lecteur vu par l'écran : il choisit le libellé de la mention. */
  viewer?: ViewerAccess;
};

const LINK_CLASS =
  'border-border hover:border-foreground/40 flex min-w-0 flex-1 flex-col gap-1 rounded-xl border p-4 no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)';

/**
 * « Étape précédente » / « Étape suivante » d'une fiche ouverte depuis un
 * parcours.
 *
 * Composant de présentation : les étapes voisines arrivent déjà calculées
 * (`adjacentSteps`). Chaque lien est construit par `entryHrefFromPath`, donc
 * la fiche suivante s'ouvre rattachée au même parcours, et son propre lien
 * « Retour au parcours » reste disponible.
 *
 * Une étape voisine dont la fiche est réservée porte sa mention (« Compte
 * requis », « Adresse à vérifier ») : le lecteur le sait avant de l'ouvrir. Le
 * lien reste actif, la fiche s'ouvre sur son titre et son résumé.
 */
export function EntryStepNav({ steps, pathSlug, reservedIds, viewer }: EntryStepNavProps) {
  const mentionOf = (entry: PathEntry) =>
    accessMention(viewer, !reservedIds?.has(entry.id)) ?? undefined;

  // Parcours d'une seule étape : rien à enchaîner.
  if (steps.previous === null && steps.next === null) {
    return null;
  }

  return (
    // Empilés sur un écran étroit, côte à côte au-delà.
    <nav aria-label="Étapes du parcours" className="flex flex-col gap-3 sm:flex-row">
      {steps.previous ? (
        <StepLink
          entry={steps.previous}
          pathSlug={pathSlug}
          direction="previous"
          access={mentionOf(steps.previous)}
        />
      ) : null}
      {steps.next ? (
        <StepLink
          entry={steps.next}
          pathSlug={pathSlug}
          direction="next"
          access={mentionOf(steps.next)}
        />
      ) : null}
    </nav>
  );
}

type StepLinkProps = {
  entry: PathEntry;
  pathSlug: string;
  direction: 'previous' | 'next';
  /** Mention d'accès de la fiche, si elle est réservée. */
  access?: string;
};

function StepLink({ entry, pathSlug, direction, access }: StepLinkProps) {
  const isNext = direction === 'next';

  return (
    <Link
      to={entryHrefFromPath(entry.slug, pathSlug)}
      // La suivante s'aligne à droite quand les deux liens sont côte à côte.
      className={`${LINK_CLASS} ${isNext ? 'sm:items-end sm:text-right' : ''}`}
    >
      <span className="text-muted flex items-center gap-1.5 text-xs">
        {isNext ? null : <ArrowLeftIcon className="size-3.5" />}
        {isNext ? 'Étape suivante' : 'Étape précédente'}
        {isNext ? <ArrowRightIcon className="size-3.5" /> : null}
      </span>
      {/* `wrap-break-word` : un titre long passe à la ligne au lieu
          d'élargir la page. */}
      <span className="text-foreground text-sm font-medium wrap-break-word">{entry.title}</span>
      {/* Pictogramme et libellé : la mention se comprend sans la couleur. */}
      {access ? (
        <span className="text-muted flex items-center gap-1 text-xs">
          <LockIcon aria-hidden="true" weight="fill" className="size-3.5" />
          {access}
        </span>
      ) : null}
    </Link>
  );
}
