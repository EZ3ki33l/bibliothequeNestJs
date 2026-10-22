import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { IconTile } from './IconTile';

/** État vide d'une liste. `icon` rappelle ce que la liste accueillera. */
export function EmptyMessage({ children, icon }: { children: ReactNode; icon?: Icon }) {
  return (
    <div className="border-border text-muted flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center text-sm">
      {icon ? <IconTile icon={icon} large /> : null}
      <div>{children}</div>
    </div>
  );
}
