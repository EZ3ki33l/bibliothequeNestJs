import { Chip } from '@heroui/react';

type PathCardProgressProps = {
  /** Étapes obligatoires et combien sont validées ; absent pour un visiteur. */
  progress: { required: number; validatedRequired: number; completed: boolean } | undefined;
};

/**
 * Progression sur une carte de parcours ou de sous-parcours, seulement si elle
 * dit quelque chose : un parcours jamais commencé n'affiche rien (« 0 validée »
 * serait du bruit sur chaque carte).
 */
export function PathCardProgress({ progress }: PathCardProgressProps) {
  if (!progress) return null;

  if (progress.completed) {
    return (
      <Chip size="sm" variant="soft" color="success">
        Terminé
      </Chip>
    );
  }

  if (progress.validatedRequired === 0 || progress.required === 0) return null;

  return (
    <span className="flex w-full items-center gap-3">
      <span aria-hidden="true" className="bg-background h-1.5 flex-1 overflow-hidden rounded-full">
        <span
          className="bg-blueberry block h-full rounded-full"
          style={{
            width: `${Math.round((progress.validatedRequired / progress.required) * 100)}%`,
          }}
        />
      </span>
      {progress.validatedRequired}/{progress.required} validées
    </span>
  );
}
