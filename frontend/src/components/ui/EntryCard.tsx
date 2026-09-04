import { Link } from 'react-router';
import { Card } from '@heroui/react';
import type { StackEntry } from '../../lib/stacks';
import { EntryMeta } from './EntryMeta';

/** Vignette d'une fiche dans une grille (page d'un stack, page d'une catégorie). */
export function EntryCard({ entry }: { entry: StackEntry }) {
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
        </Card.Footer>
      </Card>
    </Link>
  );
}
