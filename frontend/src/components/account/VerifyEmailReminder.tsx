import { useState } from 'react';
import { Button } from '@heroui/react';
import {
  authClient,
  sendVerificationEmail,
  VERIFICATION_LINK_VALIDITY,
  type VerificationRequestResult,
} from '../../lib/auth';
import { useLoginRedirect } from '../../lib/useLoginRedirect';
import { Typo } from '../ui/Typo';

type VerifyEmailReminderProps = {
  /** Adresse du compte connecté, nommée dans le rappel. */
  email: string;
  /** Page à rejoindre une fois le lien suivi (chemin interne, paramètres compris). */
  returnTo: string;
};

/** Issue affichée ; `null` tant qu'aucune demande n'a été faite ici. */
type Outcome = Exclude<VerificationRequestResult, 'unauthorized'> | null;

/**
 * Rappel « adresse à vérifier » : nomme l'adresse et propose de recevoir un
 * nouveau message.
 *
 * La demande part pour l'adresse du compte **connecté** : le serveur refuse
 * toute autre adresse et toute demande sans session. Le composant ne décide de
 * rien, il affiche ce que le serveur répond :
 * - message parti : l'adresse, la durée du lien, le courrier indésirable ;
 * - envoi en échec : le dire, et proposer de réessayer ;
 * - plafond atteint : dire quand réessayer ;
 * - adresse déjà vérifiée (l'onglet avait un état ancien) : la session est
 *   relue, le rappel disparaît de lui-même ;
 * - session expirée : retour à la connexion, en retenant la page.
 *
 * Le paragraphe `role="status"` existe dès le premier rendu, vide : c'est son
 * contenu qui change, ce qui le fait annoncer par les lecteurs d'écran.
 */
export function VerifyEmailReminder({ email, returnTo }: VerifyEmailReminderProps) {
  const { refetch } = authClient.useSession();
  const redirectToLogin = useLoginRedirect();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function request() {
    setPending(true);

    const result = await sendVerificationEmail(email, returnTo);

    setPending(false);

    if (result === 'unauthorized') {
      redirectToLogin();
      return;
    }

    setOutcome(result);

    if (result === 'already-verified') {
      void refetch();
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Typo variant="small" as="p" className="text-foreground">
        L’adresse <strong className="font-medium wrap-break-word">{email}</strong> reste à vérifier.
      </Typo>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        // Sur un téléphone étroit, le libellé passe à la ligne au lieu de
        // pousser le bouton hors de son cadre.
        className="h-auto min-h-8 max-w-full py-1.5 text-left whitespace-normal"
        isDisabled={pending}
        onPress={() => {
          void request();
        }}
      >
        {pending
          ? 'Envoi…'
          : outcome === 'unavailable'
            ? 'Réessayer'
            : 'Recevoir un nouveau message'}
      </Button>
      {/* Vide, la zone reste dans la page (`sr-only` et non `hidden`) : un
          lecteur d'écran n'annonce que les changements d'une zone déjà là. */}
      <Typo
        variant="small"
        as="p"
        role="status"
        className={
          outcome === null
            ? 'sr-only'
            : outcome === 'unavailable' || outcome === 'rate-limited'
              ? 'text-cherry-light'
              : undefined
        }
      >
        {outcome === 'sent' ? (
          <>
            Message envoyé à <span className="wrap-break-word">{email}</span>. Le lien est valable{' '}
            {VERIFICATION_LINK_VALIDITY}. Le message peut se trouver dans le courrier indésirable.
          </>
        ) : outcome === 'unavailable' ? (
          'Le message n’a pas pu être envoyé.'
        ) : outcome === 'rate-limited' ? (
          'Trop de demandes. Un nouvel essai sera possible dans une heure au plus.'
        ) : outcome === 'already-verified' ? (
          'Cette adresse est déjà vérifiée.'
        ) : null}
      </Typo>
    </div>
  );
}
