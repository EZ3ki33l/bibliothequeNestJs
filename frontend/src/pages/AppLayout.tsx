import { Outlet } from 'react-router';
import { Toast } from '@heroui/react';
import { AppBottomNav } from '../components/layout/AppBottomNav';
import { AppHeader } from '../components/layout/AppHeader';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SiteFooter } from '../components/layout/SiteFooter';
import { useIsAdmin } from '../components/layout/useIsAdmin';

/**
 * Coque du site : barre latérale, en-tête de recherche, contenu.
 *
 * La barre latérale et l'en-tête partagent le fond le plus sombre
 * (`bg-background-secondary`) ; le contenu est un cran plus clair. C'est cet
 * écart de teinte qui sépare les zones, pas un trait.
 *
 * Seul `<main>` défile : l'en-tête, placé au-dessus de lui dans la colonne,
 * reste donc toujours visible.
 */
export function AppLayout() {
  const isAdmin = useIsAdmin();

  return (
    <div className="flex h-full">
      <Toast.Provider placement="top" />
      <AppSidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="page-container flex min-h-full flex-col gap-16 pt-8 pb-24 lg:py-8">
            {/* Un seul enfant flex au-dessus du pied de page : sans ce wrapper, un
                fragment de page (accueil = deux <section>) fuitait comme plusieurs
                colonnes, et le gap s’insérait aussi entre les blocs du contenu. */}
            <div className="flex min-h-0 flex-1 flex-col">
              <Outlet />
            </div>
            <SiteFooter />
          </div>
        </main>
      </div>
      <AppBottomNav isAdmin={isAdmin} />
    </div>
  );
}
