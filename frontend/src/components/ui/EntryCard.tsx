import { Link } from 'react-router';
import { Card } from '@heroui/react';
import { CubeIcon, FunctionIcon, LightbulbIcon, type Icon } from '@phosphor-icons/react';
import type { EntryKind, StackEntry } from '../../lib/stacks';
import { CoverCard } from './CoverCard';
import { IconTile } from './IconTile';
import type { EntryState } from '../../lib/entryProgress';
import { EntryMarkers } from './EntryMarkers';
import { EntryMeta } from './EntryMeta';
import { LabMention } from './LabMention';

type EntryCardProps = {
  entry: StackEntry;
  /**
   * Repères du compte connecté pour cette fiche (lue, examen réussi, favori).
   * Absent pour un visiteur ou tant que les repères ne sont pas chargés : la
   * carte est alors exactement celle d'avant.
   */
  state?: EntryState;
  /**
   * Mention d'accès d'une fiche réservée (« Compte requis », « Adresse à
   * vérifier »). Absente pour une fiche en accès libre ou un compte vérifié.
   */
  access?: string;
  cover?: boolean;
};

/** Pictogramme du type de fiche, à côté de son libellé (`EntryMeta`). */
const KIND_ICON: Record<EntryKind, Icon> = {
  FUNCTION: FunctionIcon,
  COMPONENT: CubeIcon,
  CONCEPT: LightbulbIcon,
};

/**
 * Vignette d'une fiche dans une grille (leçon, catégorie, recherche, favoris).
 *
 * `cover` : carte à couverture, comme les parcours et les leçons. Réservée aux
 * listes courtes (favoris) ; une leçon de trente fiches en couvertures serait
 * trop haute à parcourir.
 */
export function EntryCard({ entry, state, access, cover = false }: EntryCardProps) {
  const meta = (
    <>
      <EntryMeta kind={entry.kind} difficulty={entry.difficulty} />
      <LabMention lab={entry.lab} />
      <EntryMarkers state={state} access={access} />
    </>
  );

  if (cover) {
    return (
      <CoverCard
        to={`/entries/${entry.slug}`}
        icon={KIND_ICON[entry.kind]}
        title={entry.title}
        description={entry.summary}
        meta={meta}
      />
    );
  }

  return (
    <Link to={`/entries/${entry.slug}`} className="block h-full no-underline">
      <Card className="card-interactive h-full">
        <div className="flex items-start gap-3">
          <IconTile icon={KIND_ICON[entry.kind]} />
          <Card.Header className="min-w-0">
            <Card.Title className="text-base">{entry.title}</Card.Title>
            {entry.summary ? (
              <Card.Description className="line-clamp-2">{entry.summary}</Card.Description>
            ) : null}
          </Card.Header>
        </div>
        <Card.Footer className="flex flex-wrap gap-2">{meta}</Card.Footer>
      </Card>
    </Link>
  );
}
