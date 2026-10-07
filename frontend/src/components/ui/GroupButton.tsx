import { buttonVariants } from '@heroui/react';
import { SignInIcon, UserCircleIcon } from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router';
import { currentReturnTo, loginHref, registerHref } from '../../lib/returnTo';

/**
 * Bloc « Invité » du menu : liens de connexion et d'inscription.
 *
 * Ces liens sont visibles sur toutes les pages : ils retiennent donc la page
 * courante (`?retour=`), pour qu'une connexion engagée depuis une fiche ramène
 * à cette fiche et non à l'accueil.
 */
export default function AuthGroupButton() {
  const current = currentReturnTo(useLocation());

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 px-2 py-1">
        <span className="bg-surface ring-border flex size-8 items-center justify-center rounded-full ring-1">
          <UserCircleIcon className="text-muted size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Invité</p>
          <p className="text-muted text-xs">Non connecté</p>
        </div>
      </div>
      <Link
        to={loginHref(current)}
        className={`${buttonVariants({ variant: 'primary', fullWidth: true })} justify-center gap-2 no-underline`}
      >
        <SignInIcon className="size-4" />
        Se connecter
      </Link>
      <Link
        to={registerHref(current)}
        className="text-muted hover:text-foreground block w-full py-1.5 text-center text-sm no-underline transition-colors duration-150"
      >
        S&apos;enregistrer
      </Link>
    </div>
  );
}
