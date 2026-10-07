import { buttonVariants } from '@heroui/react';
import { PageHeader } from '../components/ui/PageHeader';
import { Typo } from '../components/ui/Typo';

/**
 * Écran d’incident d’affichage (FR-005).
 *
 * Affiché par `AppErrorBoundary` quand un composant plante au rendu.
 * Ce n’est pas une route `/500` : il n’y a pas d’URL dédiée. Le visiteur
 * ne doit jamais y lire `error.message` ni une stack — jargon interne,
 * inutile, et parfois trop bavard (chemins, noms de composants).
 *
 * Cadre propre : la limite d’erreur remplace tout `<App />`, donc la
 * sidebar n’est plus là. On reprend les mêmes marges que `AppLayout`.
 */
export function ErrorPage() {
  return (
    <div className="page-container flex min-h-full flex-col py-8">
      <PageHeader
        title="Impossible d’afficher cette page"
        description="Un problème d’affichage s’est produit. L’accueil permet de reprendre."
      />
      <Typo variant="p">
        <a href="/" className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
          Retour à l’accueil
        </a>
      </Typo>
    </div>
  );
}
