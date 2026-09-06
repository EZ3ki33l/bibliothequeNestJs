import { Outlet } from 'react-router';
import { Toast } from '@heroui/react';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SiteFooter } from '../components/layout/SiteFooter';

export function AppLayout() {
  return (
    <div className="flex h-full">
      <Toast.Provider placement="top" />
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-16 px-6 py-8">
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
  );
}
