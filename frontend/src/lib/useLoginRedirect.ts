import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { currentReturnTo, loginHref } from './returnTo';

/**
 * Renvoie une fonction qui conduit à la connexion **en retenant la page
 * courante** (`/login?retour=…`), pour y revenir une fois connecté.
 *
 * À utiliser partout où une page réservée découvre qu'il n'y a pas, ou plus, de
 * session (401 du serveur) : sans cela, la connexion ramènerait à l'accueil et
 * la page voulue serait perdue.
 *
 * `replace: true` : la page réservée ne reste pas dans l'historique, sinon le
 * bouton « retour » y ramènerait, puis de nouveau à la connexion.
 */
export function useLoginRedirect(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  const current = currentReturnTo(location);

  return useCallback(() => {
    void navigate(loginHref(current), { replace: true });
  }, [navigate, current]);
}
