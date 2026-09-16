import { Link } from 'react-router';
import { isNavActive, type NavItem } from './navItems';

/** Groupe de liens de nav (titre + items) — partagé par la sidebar desktop et le panneau « Plus » mobile. */
export function NavSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-muted px-2.5 pb-1 text-[11px] font-medium tracking-wide uppercase">
        {title}
      </p>
      {items.map((item) => {
        const active = isNavActive(pathname, item);
        const Icon = item.icon;

        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150 ${
              active
                ? 'bg-surface text-foreground'
                : 'text-muted hover:bg-surface/60 hover:text-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
