import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Button, Form } from '@heroui/react';
import { authClient } from '../lib/auth';
import { AuthField } from '../components/AuthField';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';

/**
 * Inscription par courriel (better-auth).
 *
 * Page publique. Le mot de passe ne transite jamais par Nest : better-auth
 * le hash côté serveur. Les liens CGU / confidentialité pointent vers les
 * pages de confiance déjà publiées — on n'invente pas de case à cocher
 * (pas d'endpoint qui stockerait un consentement).
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session?.user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(form: HTMLFormElement) {
    setError(null);
    setPending(true);

    const data = new FormData(form);
    const { error: signUpError } = await authClient.signUp.email({
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      password: String(data.get('password') ?? ''),
    });

    setPending(false);

    if (signUpError) {
      setError(signUpError.message ?? 'Impossible de créer le compte');
      return;
    }

    navigate('/');
  }

  return (
    <>
      <PageHeader
        title="Créer un compte"
        description="Un compte ouvre les examens et les révisions. Le catalogue reste accessible sans inscription."
      />
      <Form
        className="flex flex-col gap-4"
        validationBehavior="aria"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(event.currentTarget);
        }}
      >
        <AuthField name="name" label="Nom" autoComplete="name" isRequired minLength={2} />
        <AuthField name="email" type="email" label="Email" autoComplete="email" isRequired />
        <AuthField
          name="password"
          type="password"
          label="Mot de passe"
          autoComplete="new-password"
          isRequired
          minLength={8}
        />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <Button type="submit" variant="primary" isDisabled={pending}>
          {pending ? 'Création…' : 'Créer le compte'}
        </Button>
      </Form>
      <p className="text-muted mt-6 text-xs leading-relaxed">
        La création d’un compte vaut acceptation des{' '}
        <Link
          to="/cgu"
          className="text-foreground hover:text-foreground no-underline transition-colors duration-150"
        >
          conditions d’utilisation
        </Link>{' '}
        et la{' '}
        <Link
          to="/confidentialite"
          className="text-foreground hover:text-foreground no-underline transition-colors duration-150"
        >
          politique de confidentialité
        </Link>
        .
      </p>
      <p className="text-muted mt-4 text-sm">
        Déjà un compte ?{' '}
        <Link
          to="/login"
          className="text-foreground hover:text-foreground no-underline transition-colors duration-150"
        >
          Se connecter
        </Link>
      </p>
    </>
  );
}
