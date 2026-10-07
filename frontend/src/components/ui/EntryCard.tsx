import { Link } from 'react-router';
import { Card } from '@heroui/react';
import type { StackEntry } from '../../lib/stacks';
import type { EntryState } from '../../lib/entryProgress';
import { EntryMarkers } from './EntryMarkers';
import { EntryMeta } from './EntryMeta';

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
};

/** Vignette d'une fiche dans une grille (leçon, catégorie, recherche, favoris, notes). */
export function EntryCard({ entry, state, access }: EntryCardProps) {
  return (
    <Link to={`/entries/${entry.slug}`} className="block h-full no-underline">
      <Card className="hover:bg-surface-hover h-full transition-colors duration-150">
        <Card.Header>
          <Card.Title className="text-base">{entry.title}</Card.Title>
          {entry.summary ? (
            <Card.Description className="line-clamp-2">{entry.summary}</Card.Description>
          ) : null}
        </Card.Header>
        <Card.Footer className="flex flex-wrap gap-2">
          <EntryMeta kind={entry.kind} difficulty={entry.difficulty} />
          <EntryMarkers state={state} access={access} />
        </Card.Footer>
      </Card>
    </Link>
  );
}
