import { Fragment } from 'react';
import { Link } from 'react-router';

type Crumb = {
  label: string;
  to?: string;
};

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 ? <span className="text-muted/50">/</span> : null}
          {item.to ? (
            <Link
              to={item.to}
              className="text-muted hover:text-foreground no-underline transition-colors duration-150"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
