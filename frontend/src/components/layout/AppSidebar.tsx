import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  ArticleIcon,
  ArrowCircleRightIcon,
  BooksIcon,
  FoldersIcon,
  SquaresFourIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { Button, Skeleton } from '@heroui/react';
import { authClient } from '../../lib/auth';
import { getAdminMe } from '../../lib/admin';
import Avatar from '../ui/Avatar';
import AuthGroupButton from '../ui/GroupButton';

type NavItem = {
  to: string;
  label: string;
  icon: typeof BooksIcon;
  exact?: boolean;
};

const LIBRARY_NAV: NavItem[] = [
  { to: '/', label: 'Accueil', icon: BooksIcon, exact: true },
  { to: '/stacks', label: 'Stacks', icon: StackIcon },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: SquaresFourIcon, exact: true },
  { to: '/admin/entries', label: 'Fiches', icon: ArticleIcon },
  { to: '/admin/stacks', label: 'Stacks', icon: StackIcon },
  { to: '/admin/categories', label: 'Catégories', icon: FoldersIcon },
];

function isNavActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
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

export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getAdminMe()
      .then((result) => {
        if (!cancelled) setIsAdmin(result === 'ok');
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const currentUser = session?.user ?? null;

  return (
    <aside className="border-border bg-background-secondary flex h-full w-64 shrink-0 flex-col border-r px-3 py-4">
      <Link to="/" className="mb-6 px-2 text-sm font-medium tracking-tight">
        Bibliothèque
      </Link>

      <nav className="flex flex-1 flex-col gap-5">
        <NavSection title="Bibliothèque" items={LIBRARY_NAV} pathname={pathname} />
        {isAdmin && currentUser ? (
          <NavSection title="Admin" items={ADMIN_NAV} pathname={pathname} />
        ) : null}
      </nav>

      <div className="border-border mt-auto border-t pt-3">
        {isPending && !currentUser ? (
          <Skeleton className="h-10 rounded-lg" />
        ) : currentUser ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-2 py-1">
              <Avatar name={currentUser.name} email={currentUser.email} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{currentUser.name}</p>
                <p className="text-muted truncate text-xs">{currentUser.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="text-muted w-full justify-start"
              onPress={async () => {
                await authClient.signOut();
                void navigate('/');
              }}
            >
              <ArrowCircleRightIcon className="size-4" />
              Déconnexion
            </Button>
          </div>
        ) : (
          <AuthGroupButton />
        )}
      </div>
    </aside>
  );
}
