import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { authClient } from '../lib/auth';
import { AuthField } from '../components/AuthField';

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    });

    setPending(false);

    if (signInError) {
      setError('Email ou mot de passe incorrect');
      return;
    }

    navigate('/');
  }

  return (
    <main>
      <h1>Connexion</h1>
      <form onSubmit={onSubmit}>
        <AuthField name="email" type="email" label="Email" autoComplete="email" required />
        <AuthField
          name="password"
          type="password"
          label="Mot de passe"
          autoComplete="current-password"
          required
        />
        {error ? <p>{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <p>
        Pas encore de compte ? <Link to="/register">S&apos;enregistrer</Link>
      </p>
    </main>
  );
}
