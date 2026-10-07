import { Link } from 'react-router';
import { CaretRightIcon } from '@phosphor-icons/react';

type Crumb = {
  label: string;
  to?: string;
};

/**
 * Fil d'Ariane : où se trouve la page dans le catalogue, et comment remonter.
 *
 * Une liste ordonnée, parce que c'est un chemin. Chaque niveau parent est un
 * lien ; le dernier élément, la page courante, n'en est pas un et porte
 * `aria-current="page"`. Le chevron est décoratif : il est masqué aux lecteurs
 * d'écran, qui annoncent déjà une liste.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 ? (
              <CaretRightIcon aria-hidden="true" className="text-muted size-3 shrink-0" />
            ) : null}
            {item.to ? (
              <Link
                to={item.to}
                className="text-blueberry-light truncate no-underline underline-offset-4 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground truncate font-medium">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
