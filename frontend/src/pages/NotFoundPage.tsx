import { Link } from 'react-router';
import { buttonVariants } from '@heroui/react';
import { PageHeader } from '../components/ui/PageHeader';

/**
 * Page introuvable (US2 / FR-004).
 *
 * Affichée par la route catch-all `path="*"` : l’adresse ne correspond à
 * aucune page connue (`/page-inventee`). Ce n’est pas le 404 métier du
 * catalogue (`/stacks/:slug` inconnu reste dans `StackPage`).
 *
 * Public : pas de session, pas de garde. Liens vers `/` et `/stacks`
 * (contrats/routes.md) pour ne pas laisser le visiteur sans issue.
 */
export function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Page introuvable"
        description="Cette adresse ne correspond à aucune page du site. L’accueil et le catalogue restent accessibles."
      />
      <div className="flex flex-wrap gap-3">
        <Link to="/" className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
          Retour à l’accueil
        </Link>
        <Link to="/stacks" className={`${buttonVariants({ variant: 'secondary' })} no-underline`}>
          Parcourir le catalogue
        </Link>
      </div>
    </>
  );
}
