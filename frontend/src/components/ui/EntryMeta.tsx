import { Chip } from '@heroui/react';
import type { Difficulty, EntryKind } from '../../lib/stacks';
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL, KIND_LABEL } from '../../lib/labels';

type EntryMetaProps = {
  kind: EntryKind;
  difficulty: Difficulty;
};

/**
 * Puces « type » et « difficulté » d'une fiche, utilisées par `EntryCard` et
 * par la page d'une fiche.
 *
 * Les libellés viennent de `lib/labels.ts` : les valeurs de la base sont en
 * anglais (`FUNCTION`, `BEGINNER`) et leur traduction est décidée à un seul
 * endroit, jamais recopiée dans un composant.
 *
 * Le composant ne rend volontairement aucun conteneur (fragment `<>`) : c'est
 * l'appelant qui choisit la mise en page de la rangée.
 */
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
