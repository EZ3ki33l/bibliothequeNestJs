import { Link, useLocation } from 'react-router';
import { authClient } from '../../lib/auth';
import { AccountBlock } from './AccountBlock';
import { NavSection } from './NavSection';
import { ADMIN_NAV, LIBRARY_NAV, LIBRARY_NAV_SIGNED_IN, type NavItem } from './navItems';

/** Sidebar statique — visible uniquement à partir de `lg:` ; en dessous, {@link AppBottomNav} prend le relais. */
export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const { pathname } = useLocation();
  const { data: session } = authClient.useSession();
  const currentUser = session?.user ?? null;
  const libraryItems: NavItem[] = currentUser
    ? [...LIBRARY_NAV, ...LIBRARY_NAV_SIGNED_IN]
    : LIBRARY_NAV;

  return (
    <aside className="border-border bg-background-secondary hidden h-full w-64 shrink-0 flex-col border-r px-3 py-4 lg:flex">
      <Link to="/" className="mb-6 px-2 text-sm font-medium tracking-tight">
        Bibliothèque
      </Link>

      <nav className="flex flex-1 flex-col gap-5">
        <NavSection title="Bibliothèque" items={libraryItems} pathname={pathname} />
        {isAdmin && currentUser ? (
          <NavSection title="Admin" items={ADMIN_NAV} pathname={pathname} />
        ) : null}
      </nav>

      <div className="border-border mt-auto border-t pt-3">
        <AccountBlock />
      </div>
    </aside>
  );
}
