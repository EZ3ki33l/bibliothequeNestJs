import { Link } from 'react-router';
import { buttonVariants } from '@heroui/react';

type NotFoundStateProps = {
  /** Ce qui est introuvable : « Fiche introuvable. » */
  message: string;
  /** Liste où chercher autre chose : « Toutes les leçons », « Tous les parcours ». */
  listLink?: { to: string; label: string };
};

/**
 * État « introuvable » d'une page de contenu (fiche, parcours, leçon,
 * catégorie).
 *
 * Le lien vers l'accueil est **toujours** là : aucune page ne laisse sans
 * suite. Un composant plutôt qu'une phrase recopiée garantit que la prochaine
 * page introuvable n'oubliera pas ses liens.
 *
 * Le même message sert pour un contenu inconnu et pour un contenu non publié :
 * la page ne dit pas lequel des deux, et l'onglet garde un titre neutre.
 */
export function NotFoundState({ message, listLink }: NotFoundStateProps) {
  return (
    <div className="border-border flex flex-col items-center gap-5 rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="text-muted text-sm">{message}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {listLink ? (
          <Link
            to={listLink.to}
            className={`${buttonVariants({ variant: 'primary', size: 'sm' })} no-underline`}
          >
            {listLink.label}
          </Link>
        ) : null}
        <Link
          to="/"
          className={`${buttonVariants({ variant: listLink ? 'secondary' : 'primary', size: 'sm' })} no-underline`}
        >
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
