import {
  ArticleIcon,
  BooksIcon,
  CardsIcon,
  FoldersIcon,
  HeartIcon,
  NotePencilIcon,
  PathIcon,
  SquaresFourIcon,
  StackIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react';

export type NavItem = {
  to: string;
  label: string;
  icon: typeof BooksIcon;
  exact?: boolean;
};

export const LIBRARY_NAV: NavItem[] = [
  { to: '/', label: 'Accueil', icon: BooksIcon, exact: true },
  { to: '/parcours', label: 'Parcours', icon: PathIcon },
  { to: '/stacks', label: 'Stacks', icon: StackIcon },
  { to: '/recherche', label: 'Recherche', icon: MagnifyingGlassIcon },
];

export const LIBRARY_NAV_SIGNED_IN: NavItem[] = [
  { to: '/review', label: 'Révisions', icon: CardsIcon },
  { to: '/favoris', label: 'Favoris', icon: HeartIcon },
  { to: '/notes', label: 'Notes', icon: NotePencilIcon },
];

export const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: SquaresFourIcon, exact: true },
  { to: '/admin/entries', label: 'Fiches', icon: ArticleIcon },
  { to: '/admin/parcours', label: 'Parcours', icon: PathIcon },
  { to: '/admin/stacks', label: 'Stacks', icon: StackIcon },
  { to: '/admin/categories', label: 'Catégories', icon: FoldersIcon },
];

export function isNavActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
