import { useState } from 'react';
import { Link } from 'react-router';
import { Button, Form } from '@heroui/react';
import { requestPasswordReset, type PasswordResetResult } from '../lib/auth';
import { AuthField } from '../components/AuthField';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';

const LINK_CLASS =
  'text-foreground hover:text-foreground no-underline transition-colors duration-150';

/** Refus affichables ; `ok` ouvre l'écran de confirmation, jamais un message d'erreur. */
const REFUSAL_MESSAGES: Record<Exclude<PasswordResetResult, 'ok'>, string> = {
  'rate-limited': 'Trop de demandes. Réessayer dans une heure',
  unavailable: 'L’envoi de courriels est momentanément indisponible. Réessayer plus tard',
  'invalid-token': 'Une erreur est survenue',
  'password-too-short': 'Une erreur est survenue',
};

/**
 * « Mot de passe oublié » : le courriel saisi reçoit un lien de
 * réinitialisation (valable une heure, usage unique).
 *
 * L'écran de confirmation est **identique** que le compte existe ou non : le
 * serveur ne révèle pas quelles adresses sont inscrites (énumération de
 * comptes), la page ne doit donc rien laisser deviner non plus.
 */
export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(form: HTMLFormElement) {
    setError(null);
    setPending(true);

    try {
      const result = await requestPasswordReset(
        String(new FormData(form).get('email') ?? '').trim(),
      );

      if (result === 'ok') {
        setSent(true);
        return;
      }

      setError(REFUSAL_MESSAGES[result]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Une erreur est survenue');
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <>
        <PageHeader
          title="Courriel envoyé"
          description="Si un compte existe pour cette adresse, un courriel contenant un lien de réinitialisation vient d’être envoyé. Le lien est valable une heure."
        />
        <p className="text-muted text-sm">
          Rien reçu ? Vérifier les courriers indésirables, puis{' '}
          <button
            type="button"
            className={`${LINK_CLASS} cursor-pointer`}
            onClick={() => setSent(false)}
          >
            recommencer
          </button>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mot de passe oublié"
        description="Un lien pour choisir un nouveau mot de passe est envoyé à l’adresse du compte."
      />
      <Form
        className="flex flex-col gap-4"
        validationBehavior="aria"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(event.currentTarget);
        }}
      >
        <AuthField name="email" type="email" label="Email" autoComplete="email" isRequired />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <Button type="submit" variant="primary" isDisabled={pending}>
          {pending ? 'Envoi…' : 'Envoyer le lien'}
        </Button>
      </Form>
      <p className="text-muted mt-6 text-sm">
        <Link to="/login" className={LINK_CLASS}>
          Retour à la connexion
        </Link>
      </p>
    </>
  );
}
