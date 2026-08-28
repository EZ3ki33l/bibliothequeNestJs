import { Chip } from '@heroui/react';
import type { Difficulty, EntryKind } from '../../lib/stacks';
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL, KIND_LABEL } from '../../lib/labels';

type EntryMetaProps = {
  kind: EntryKind;
  difficulty: Difficulty;
};

/* Rend les puces sans conteneur : c'est l'appelant qui fournit la rangée. */
export function EntryMeta({ kind, difficulty }: EntryMetaProps) {
  return (
    <>
      <Chip size="sm" variant="soft">
        {KIND_LABEL[kind]}
      </Chip>
      <Chip size="sm" variant="soft" color={DIFFICULTY_COLOR[difficulty]}>
        {DIFFICULTY_LABEL[difficulty]}
      </Chip>
    </>
  );
}
