import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { authClient } from '../lib/auth';
import { AuthField } from '../components/AuthField';

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const { error: signUpError } = await authClient.signUp.email({
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    });

    setPending(false);

    if (signUpError) {
      setError(signUpError.message ?? 'Impossible de créer le compte');
      return;
    }

    navigate('/');
  }

  return (
    <main>
      <h1>Créer un compte</h1>
      <form onSubmit={onSubmit}>
        <AuthField name="name" label="Nom" autoComplete="name" required minLength={2} />
        <AuthField name="email" type="email" label="Email" autoComplete="email" required />
        <AuthField
          name="password"
          type="password"
          label="Mot de passe"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {error ? <p>{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? 'Création…' : "S'enregistrer"}
        </button>
      </form>
      <p>
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </main>
  );
}
