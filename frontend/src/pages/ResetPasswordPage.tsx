import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, Form } from '@heroui/react';
import { resetPassword, type PasswordResetResult } from '../lib/auth';
import { AuthField } from '../components/AuthField';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';

const LINK_CLASS =
  'text-foreground hover:text-foreground no-underline transition-colors duration-150';

/** Refus affichables ; `ok` bascule sur l'écran de succès. */
const REFUSAL_MESSAGES: Record<Exclude<PasswordResetResult, 'ok' | 'invalid-token'>, string> = {
  'password-too-short': 'Le mot de passe doit contenir au moins 8 caractères',
  'rate-limited': 'Trop de tentatives. Réessayer dans quelques minutes',
  unavailable: 'Le service est momentanément indisponible. Réessayer plus tard',
};

/**
 * Page d'arrivée du lien reçu par courriel : `?token=…` si le lien est valide,
 * `?error=INVALID_TOKEN` s'il est expiré ou inconnu (better-auth redirige
 * ainsi depuis l'API).
 *
 * Le jeton n'est qu'un aiguillage : c'est le serveur qui décide, à la
 * soumission, s'il est valide — il est à usage unique et expire en une heure.
 * Un lien déjà utilisé mène donc à l'écran « lien invalide », pas à une erreur
 * technique.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [linkInvalid, setLinkInvalid] = useState(searchParams.get('error') !== null || !token);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(form: HTMLFormElement) {
    if (!token) return;

    setError(null);
    setPending(true);

    try {
      const result = await resetPassword(String(new FormData(form).get('password') ?? ''), token);

      if (result === 'ok') {
        setDone(true);
      } else if (result === 'invalid-token') {
        setLinkInvalid(true);
      } else {
        setError(REFUSAL_MESSAGES[result]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Une erreur est survenue');
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <>
        <PageHeader
          title="Mot de passe modifié"
          description="Les sessions ouvertes ont été fermées : la connexion se fait avec le nouveau mot de passe."
        />
        <Link to="/login" className={LINK_CLASS}>
          Se connecter
        </Link>
      </>
    );
  }

  if (linkInvalid) {
    return (
      <>
        <PageHeader
          title="Lien invalide"
          description="Ce lien a expiré ou a déjà été utilisé. Un nouveau lien peut être demandé."
        />
        <Link to="/mot-de-passe-oublie" className={LINK_CLASS}>
          Demander un nouveau lien
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Nouveau mot de passe"
        description="Choisir un mot de passe d’au moins 8 caractères."
      />
      <Form
        className="flex flex-col gap-4"
        validationBehavior="aria"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(event.currentTarget);
        }}
      >
        <AuthField
          name="password"
          type="password"
          label="Nouveau mot de passe"
          autoComplete="new-password"
          isRequired
          minLength={8}
        />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <Button type="submit" variant="primary" isDisabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </Button>
      </Form>
    </>
  );
}
