import { Link } from 'react-router';
import { isNavActive, type NavItem } from './navItems';
import { Typo } from '../ui/Typo';

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
      <Typo variant="caption" className="px-2.5 pb-1 font-medium">
        {title}
      </Typo>
      {items.map((item) => {
        const active = isNavActive(pathname, item);
        const Icon = item.icon;

        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm no-underline transition-colors duration-150 ${
              active
                ? 'bg-blueberry/15 text-blueberry-light font-medium'
                : 'text-muted hover:bg-background hover:text-foreground'
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
