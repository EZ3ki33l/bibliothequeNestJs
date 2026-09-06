import { Link } from 'react-router';
import { buttonVariants } from '@heroui/react';
import { PageHeader } from '../components/ui/PageHeader';
import { SITE_LEGAL, canUseMailto, isLegalPlaceholder } from '../lib/site-legal';

/**
 * Contact (US4 / FR-011).
 *
 * Affichage + `mailto` si l’adresse est réelle. Pas de `<form>`, pas de POST :
 * envoyer un message depuis le site ouvrirait spam et injection, hors de cette
 * feature (pas d’endpoint Nest, pas de throttler dédié).
 */
export function ContactPage() {
  const email = SITE_LEGAL.contactEmail;
  const mailtoOk = canUseMailto(email);

  return (
    <>
      <PageHeader
        title="Contact"
        description="Le courriel ci-dessous ouvre le client de messagerie. Aucun message n’est transmis depuis cette page."
      />

      <p className="mb-4 text-sm">Courriel :</p>
      <p className={isLegalPlaceholder(email) ? 'text-muted mb-6 text-sm italic' : 'mb-6 text-sm'}>
        {email}
      </p>

      {mailtoOk ? (
        <a
          href={`mailto:${email}`}
          className={`${buttonVariants({ variant: 'primary' })} no-underline`}
        >
          Écrire un message
        </a>
      ) : (
        <p className="text-muted text-sm">
          Le lien d’écriture sera actif dès qu’une adresse réelle sera renseignée (avant mise en
          ligne). En attendant, les mentions restent aux{' '}
          <Link
            to="/mentions-legales"
            className="text-foreground hover:text-foreground no-underline transition-colors duration-150"
          >
            mentions légales
          </Link>
          .
        </p>
      )}
    </>
  );
}
