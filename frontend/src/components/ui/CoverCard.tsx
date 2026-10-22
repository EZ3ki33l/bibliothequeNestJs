import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Card } from '@heroui/react';
import type { Icon } from '@phosphor-icons/react';

type CoverCardProps = {
  to: string;
  icon: Icon;
  title: string;
  description?: string | null;
  meta: ReactNode;
};

/**
 * Carte de catalogue (parcours, leçon) : une couverture, puis titre, résumé et
 * repères.
 *
 * La carte applique à elle seule le 60-30-10 de la charte : Black Sea pour le
 * corps (60 %), Blueberry pour la couverture (30 %), Cherry pour le seul
 * pictogramme de premier plan (10 %). La couverture n'a pas de texte : le
 * contraste du texte ne dépend pas d'elle.
 */
export function CoverCard({ to, icon: IconComponent, title, description, meta }: CoverCardProps) {
  return (
    <Link to={to} className="group block h-full no-underline">
      <Card className="card-interactive h-full gap-0 overflow-hidden p-0">
        <div
          aria-hidden="true"
          className="bg-blueberry/25 text-blueberry-light relative h-20 shrink-0 overflow-hidden"
        >
          <IconComponent
            weight="duotone"
            className="text-cherry-light absolute bottom-3 left-4 size-9"
          />
          <IconComponent
            weight="thin"
            className="absolute -right-5 -bottom-9 size-32 opacity-40 transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:-rotate-6 group-focus-visible:-translate-y-1 group-focus-visible:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:transform-none motion-reduce:group-focus-visible:transform-none"
          />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <Card.Header className="gap-1">
            <Card.Title className="text-base">{title}</Card.Title>
            {description ? (
              <Card.Description className="line-clamp-3">{description}</Card.Description>
            ) : null}
          </Card.Header>
          <Card.Footer className="text-muted mt-auto flex flex-wrap items-center gap-2 text-xs">
            {meta}
          </Card.Footer>
        </div>
      </Card>
    </Link>
  );
}
