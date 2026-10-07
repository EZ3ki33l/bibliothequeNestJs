import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Skeleton, buttonVariants, toast } from '@heroui/react';
import { authClient } from '../lib/auth';
import { loginHref, safeReturnTo } from '../lib/returnTo';
import { viewerAccess } from '../lib/viewerAccess';
import { VerifyEmailReminder } from '../components/account/VerifyEmailReminder';
import { PageHeader } from '../components/ui/PageHeader';

/**
 * Page d'arrivée du lien de vérification (`/adresse-verifiee`).
 *
 * Le lien du message pointe vers l'API, qui vérifie l'adresse puis redirige
 * ici : sans paramètre d'erreur si le jeton était valide, avec `?error=` sinon
 * (`TOKEN_EXPIRED`, `INVALID_TOKEN`…).
 *
 * **La page n'ouvre rien** : elle affiche ce que le serveur a déjà fait. Une
 * adresse `/adresse-verifiee` écrite à la main ne vérifie donc aucun compte.
 * Avec une session, la page relit d'ailleurs le compte auprès du serveur avant
 * d'annoncer quoi que ce soit : c'est lui qui dit si l'adresse est vérifiée,
 * pas l'absence d'erreur dans l'adresse.
 *
 * Le lien ne connecte personne. Ouvert dans un navigateur sans session, il
 * mène à l'invitation à se connecter, qui retient la destination.
 *
 * `retour` est la page à rejoindre ensuite. Le paramètre est lisible et
 * modifiable par n'importe qui : il passe par `safeReturnTo` **au moment de
 * naviguer**, qui ne garde qu'un chemin interne au site.
 *
 * Tout code d'erreur autre que l'expiration est présenté comme « lien non
 * valide », y compris « compte introuvable » : la page ne dit pas si un compte
 * existe.
 */
export function EmailVerifiedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const destination = safeReturnTo(searchParams.get('retour'));
  const { data: session, isPending, refetch } = authClient.useSession();
  const user = session?.user;
  const hasSession = Boolean(user);
  const verified = viewerAccess(user) === 'verified';

  // Le compte a-t-il été relu auprès du serveur depuis l'arrivée sur la page ?
  const [checked, setChecked] = useState(false);
  const refetchStarted = useRef(false);

  useEffect(() => {
    if (error !== null || isPending || !hasSession || refetchStarted.current) return;

    refetchStarted.current = true;
    void refetch()
      .catch(() => undefined)
      .finally(() => setChecked(true));
  }, [error, isPending, hasSession, refetch]);

  // Adresse vérifiée, confirmée par le serveur : la page demandée s'ouvre, sans
  // reconnexion. `replace` : cette page ne reste pas dans l'historique.
  useEffect(() => {
    if (error !== null || !checked || !verified) return;

    toast.success('Adresse vérifiée.');
    void navigate(destination, { replace: true });
  }, [error, checked, verified, destination, navigate]);

  if (isPending) {
    return <Skeleton className="h-32 rounded-xl" />;
  }

  const loginLink = (
    <Link
      to={loginHref(destination)}
      className={`${buttonVariants({ variant: 'primary' })} no-underline`}
    >
      Se connecter
    </Link>
  );

  if (error !== null) {
    const title = error === 'TOKEN_EXPIRED' ? 'Ce lien a expiré.' : 'Ce lien n’est pas valide.';

    if (!user) {
      return (
        <>
          <PageHeader
            title={title}
            description="Rien n’a été vérifié. Un nouveau message se demande depuis « Mon compte », une fois connecté."
          />
          {loginLink}
        </>
      );
    }

    if (verified) {
      return (
        <>
          <PageHeader title={title} description="L’adresse du compte connecté est déjà vérifiée." />
          <Link
            to={destination}
            className={`${buttonVariants({ variant: 'primary' })} no-underline`}
          >
            Continuer
          </Link>
        </>
      );
    }

    return (
      <>
        <PageHeader
          title={title}
          description="Rien n’a été vérifié. Un nouveau message peut être demandé ici."
        />
        <VerifyEmailReminder email={user.email} returnTo={destination} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <PageHeader
          title="Adresse vérifiée."
          description="Le lien ne connecte pas : la connexion ouvre ensuite tout le catalogue."
        />
        {loginLink}
      </>
    );
  }

  // Le serveur n'a pas encore répondu, ou la navigation vers la page demandée
  // est en cours.
  if (!checked || verified) {
    return <Skeleton className="h-32 rounded-xl" />;
  }

  // Le lien suivi était valide, mais le compte connecté ici n'est pas vérifié :
  // il concernait sans doute un autre compte. Annoncer « adresse vérifiée »
  // serait faux pour ce lecteur.
  return (
    <>
      <PageHeader
        title="Adresse à vérifier"
        description="L’adresse du compte connecté reste à vérifier. Le lien suivi concernait peut-être un autre compte."
      />
      <VerifyEmailReminder email={user.email} returnTo={destination} />
    </>
  );
}
