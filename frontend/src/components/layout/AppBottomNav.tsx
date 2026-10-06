import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { DotsThreeIcon, XIcon } from '@phosphor-icons/react';
import { authClient } from '../../lib/auth';
import { AccountBlock } from './AccountBlock';
import { NavSection } from './NavSection';
import { ADMIN_NAV, LIBRARY_NAV, LIBRARY_NAV_SIGNED_IN, isNavActive } from './navItems';

const TABS = LIBRARY_NAV;

/** Barre de navigation basse — visible sous `lg:`, remplace la sidebar sur mobile/tablette. */
export function AppBottomNav({ isAdmin }: { isAdmin: boolean }) {
  const { pathname } = useLocation();
  const { data: session } = authClient.useSession();
  const currentUser = session?.user ?? null;
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsMoreOpen(false);
  }

  useEffect(() => {
    if (!isMoreOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMoreOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMoreOpen]);

  const hasMoreItems = Boolean(currentUser);

  return (
    <>
      {isMoreOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMoreOpen(false)}
          />
          <div className="border-border bg-background-secondary absolute right-0 bottom-0 left-0 flex max-h-[75vh] flex-col gap-5 overflow-y-auto rounded-t-2xl border-t px-3 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="flex items-center justify-between px-2.5">
              <p className="text-sm font-medium">Menu</p>
              <button
                type="button"
                aria-label="Fermer le menu"
                className="text-muted hover:text-foreground rounded-lg p-1.5 transition-colors duration-150"
                onClick={() => setIsMoreOpen(false)}
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {hasMoreItems ? (
              <NavSection title="Bibliothèque" items={LIBRARY_NAV_SIGNED_IN} pathname={pathname} />
            ) : null}

            {isAdmin && currentUser ? (
              <NavSection title="Admin" items={ADMIN_NAV} pathname={pathname} />
            ) : null}

            <div className="border-border border-t pt-3">
              <AccountBlock />
            </div>
          </div>
        </div>
      ) : null}

      <nav className="border-border bg-background-secondary fixed inset-x-0 bottom-0 z-50 flex border-t pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TABS.map((item) => {
          const active = isNavActive(pathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-150 ${
                active ? 'text-foreground' : 'text-muted'
              }`}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={isMoreOpen}
          aria-label="Plus d'options"
          onClick={() => setIsMoreOpen((open) => !open)}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-150 ${
            isMoreOpen ? 'text-foreground' : 'text-muted'
          }`}
        >
          <DotsThreeIcon className="size-5" />
          Plus
        </button>
      </nav>
    </>
  );
}
