import { Chip } from '@heroui/react';
import { FlaskIcon } from '@phosphor-icons/react';
import { LAB_TOOL_LABEL } from '../../lib/labels';
import type { EntryLabSummary } from '../../lib/stacks';

/**
 * Mention « Laboratoire · <outil> » (spec 018). Pictogramme **et** texte : elle
 * se comprend sans la couleur. Rien n'est rendu pour une fiche sans laboratoire.
 */
export function LabMention({ lab }: { lab: EntryLabSummary | null | undefined }) {
  if (!lab) {
    return null;
  }

  return (
    <Chip size="sm" variant="soft" color="accent">
      <span className="inline-flex items-center gap-1">
        <FlaskIcon aria-hidden="true" weight="fill" className="size-3.5" />
        Laboratoire · {LAB_TOOL_LABEL[lab.tool]}
      </span>
    </Chip>
  );
}
