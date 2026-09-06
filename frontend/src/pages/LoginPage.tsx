import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Button, Form } from '@heroui/react';
import { authClient } from '../lib/auth';
import { AuthField } from '../components/AuthField';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';

/**
 * Connexion par courriel (better-auth).
 *
 * Page publique : pas de `SessionGuard`. Un échec affiche un message
 * générique — on ne dit pas si le courriel existe (énumération de comptes).
 * Déjà connecté : redirection vers l'accueil, le formulaire ne servirait à
 * rien. Ce n'est pas une garde d'accès, seulement de l'interface.
 */
export function LoginPage() {
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
    const { error: signInError } = await authClient.signIn.email({
      email: String(data.get('email') ?? '').trim(),
      password: String(data.get('password') ?? ''),
    });

    setPending(false);

    if (signInError) {
      setError('Email ou mot de passe incorrect');
      return;
    }

    navigate('/');
  }

  return (
    <>
      <PageHeader
        title="Connexion"
        description="Un compte ouvre les examens et les révisions. Le catalogue se parcourt sans compte."
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
        <AuthField
          name="password"
          type="password"
          label="Mot de passe"
          autoComplete="current-password"
          isRequired
        />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <Button type="submit" variant="primary" isDisabled={pending}>
          {pending ? 'Connexion…' : 'Se connecter'}
        </Button>
      </Form>
      <p className="text-muted mt-6 text-sm">
        Pas encore de compte ?{' '}
        <Link
          to="/register"
          className="text-foreground hover:text-foreground no-underline transition-colors duration-150"
        >
          Créer un compte
        </Link>
      </p>
    </>
  );
}
