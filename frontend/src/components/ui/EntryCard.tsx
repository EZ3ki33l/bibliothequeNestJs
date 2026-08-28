import { Link } from 'react-router';
import { Card, Chip } from '@heroui/react';
import type { StackEntry } from '../../lib/stacks';
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL, KIND_LABEL } from '../../lib/labels';

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
          <Chip size="sm" variant="soft">
            {KIND_LABEL[entry.kind]}
          </Chip>
          <Chip size="sm" variant="soft" color={DIFFICULTY_COLOR[entry.difficulty]}>
            {DIFFICULTY_LABEL[entry.difficulty]}
          </Chip>
        </Card.Footer>
      </Card>
    </Link>
  );
}
