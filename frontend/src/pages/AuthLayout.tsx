import { Outlet } from 'react-router';

/**
 * Cadre des écrans de connexion et d'inscription.
 *
 * `AppLayout` fournit déjà le `<main>` et le pied de page. Ce layout ne fait
 * qu'un panneau centré (`max-w-md`) : le formulaire ne s'étale pas sur la
 * largeur du catalogue. Le panneau se détache du fond par sa teinte
 * (`bg-surface`) et une ombre, sans contour — pas de couleur en dur.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center">
      <div className="bg-surface w-full max-w-md rounded-2xl px-6 py-8 shadow-[0_24px_48px_-28px_var(--color-blacksea-dark)] sm:px-8">
        <Outlet />
      </div>
    </div>
  );
}
