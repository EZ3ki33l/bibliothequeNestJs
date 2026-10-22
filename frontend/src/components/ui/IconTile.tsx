import type { Icon } from '@phosphor-icons/react';

/** Pictogramme posé sur une pastille Blueberry : tête de carte, état vide. */
export function IconTile({ icon: IconComponent, large = false }: { icon: Icon; large?: boolean }) {
  return (
    <span
      className={`bg-blueberry/15 text-blueberry-light flex shrink-0 items-center justify-center ${
        large ? 'size-12 rounded-2xl' : 'size-10 rounded-xl'
      }`}
    >
      <IconComponent aria-hidden="true" className={large ? 'size-6' : 'size-5'} />
    </span>
  );
}
