import { Outlet } from 'react-router';

/**
 * Cadre des écrans de connexion et d'inscription.
 *
 * `AppLayout` fournit déjà le `<main>` et le pied de page. Ce layout ne fait
 * qu'un panneau centré (`max-w-md`) : le formulaire ne s'étale pas sur la
 * largeur du catalogue. Les tokens (`bg-surface`, `border-border`) sont les
 * mêmes que la hero de l'accueil — pas de couleur en dur.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center">
      <div className="border-border bg-surface w-full max-w-md rounded-3xl border px-6 py-8 sm:px-8">
        <Outlet />
      </div>
    </div>
  );
}
