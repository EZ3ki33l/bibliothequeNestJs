import { Link, useLocation } from 'react-router';
import { authClient } from '../../lib/auth';
import { AccountBlock } from './AccountBlock';
import { NavSection } from './NavSection';
import { ADMIN_NAV, LIBRARY_NAV, LIBRARY_NAV_SIGNED_IN, type NavItem } from './navItems';

/**
 * Sidebar statique — visible uniquement à partir de `lg:` ; en dessous, {@link AppBottomNav} prend le relais.
 *
 * Pas de trait à droite : son fond, plus sombre que celui du contenu, suffit à
 * la détacher. Le bloc du compte est posé sur le fond du contenu, un cran plus
 * clair, plutôt que séparé par une ligne.
 */
export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const { pathname } = useLocation();
  const { data: session } = authClient.useSession();
  const currentUser = session?.user ?? null;
  const libraryItems: NavItem[] = currentUser
    ? [...LIBRARY_NAV, ...LIBRARY_NAV_SIGNED_IN]
    : LIBRARY_NAV;

  return (
    <aside className="bg-background-secondary hidden h-full w-64 shrink-0 flex-col px-3 py-4 lg:flex">
      <Link
        to="/"
        className="font-heading text-foreground mb-6 flex items-center gap-2 px-2.5 text-lg font-bold tracking-tight no-underline"
      >
        {/* `alt` vide : le nom est écrit juste à côté, un lecteur d'écran ne
            doit pas l'entendre deux fois. */}
        <img
          src="/ez3learn-logo-fond-transparent.svg"
          alt=""
          width={700}
          height={730}
          className="h-7 w-auto"
        />
        EZ3Learn
      </Link>

      <nav className="flex flex-1 flex-col gap-5">
        <NavSection title="Bibliothèque" items={libraryItems} pathname={pathname} />
        {isAdmin && currentUser ? (
          <NavSection title="Admin" items={ADMIN_NAV} pathname={pathname} />
        ) : null}
      </nav>

      <div className="bg-background mt-auto rounded-xl p-2">
        <AccountBlock />
      </div>
    </aside>
  );
}
