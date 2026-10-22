import type { ComponentType, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, Dropdown, Label, Skeleton, buttonVariants } from '@heroui/react';
import { DotsThreeIcon } from '@phosphor-icons/react';
import { Typo } from '../ui/Typo';

/** Action propre à la ressource, placée dans le menu « … » avant « Modifier ». */
export type AdminRowAction = {
  id: string;
  label: string;
  onAction: () => void;
  isDisabled?: boolean;
};

type AdminListRowProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: ReactNode;
  editTo: string;
  onDelete: () => void;
  /** Mentions affichées sur la ligne (état, laboratoire) : à lire, pas à cliquer. */
  badges?: ReactNode;
  /** Actions ajoutées au menu « … » (ex. publier, dupliquer). */
  menuActions?: AdminRowAction[];
  /** Case de sélection en tête de ligne (actions en masse). */
  selection?: ReactNode;
};

/**
 * Ligne d'une liste d'administration. Les actions sont regroupées dans un menu
 * « … » : une rangée de boutons répétée sur chaque ligne noie le titre. Le titre
 * lui-même ouvre le formulaire, le geste le plus fréquent.
 */
export function AdminListRow({
  icon: Icon,
  title,
  subtitle,
  editTo,
  onDelete,
  badges,
  menuActions = [],
  selection,
}: AdminListRowProps) {
  const navigate = useNavigate();
  const actions = new Map<string, () => void>([
    ...menuActions.map((action) => [action.id, action.onAction] as const),
    ['edit', () => void navigate(editTo)],
    ['delete', onDelete],
  ]);

  return (
    <li className="border-border flex items-center gap-3 rounded-xl border px-3 py-2.5">
      {selection}
      <Icon className="text-muted size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <Link
          to={editTo}
          className="text-foreground hover:text-blueberry-light block truncate font-medium no-underline transition-colors duration-150"
        >
          {title}
        </Link>
        <Typo variant="caption" className="block truncate">
          {subtitle}
        </Typo>
      </div>
      {badges ? <div className="flex shrink-0 items-center gap-2">{badges}</div> : null}
      <Dropdown>
        <Dropdown.Trigger
          aria-label={`Actions pour « ${title} »`}
          className={buttonVariants({ variant: 'ghost', size: 'sm', isIconOnly: true })}
        >
          <DotsThreeIcon weight="bold" className="size-5" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            aria-label={`Actions pour « ${title} »`}
            disabledKeys={menuActions
              .filter((action) => action.isDisabled)
              .map((action) => action.id)}
            onAction={(key) => actions.get(String(key))?.()}
          >
            {menuActions.map((action) => (
              <Dropdown.Item key={action.id} id={action.id} textValue={action.label}>
                <Label>{action.label}</Label>
              </Dropdown.Item>
            ))}
            <Dropdown.Item id="edit" textValue="Modifier">
              <Label>Modifier</Label>
            </Dropdown.Item>
            <Dropdown.Item id="delete" textValue="Supprimer" className="text-cherry-light">
              <Label className="text-cherry-light">Supprimer</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </li>
  );
}

export function AdminListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

type AdminPaginationProps = {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function AdminPagination({ page, limit, total, onPageChange }: AdminPaginationProps) {
  if (total <= limit) return null;

  return (
    <div className="text-muted mt-6 flex items-center gap-3 text-sm">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        isDisabled={page <= 1}
        onPress={() => onPageChange(page - 1)}
      >
        Précédent
      </Button>
      <span>
        Page {page} · {total} au total
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        isDisabled={page * limit >= total}
        onPress={() => onPageChange(page + 1)}
      >
        Suivant
      </Button>
    </div>
  );
}
