import { Link } from 'react-router';
import { authClient } from '../lib/auth';

export function HomePage() {
  const { data: session, isPending } = authClient.useSession();

  async function signOut() {
    await authClient.signOut();
  }

  if (isPending) {
    return <p>Chargement…</p>;
  }

  if (!session) {
    return (
      <main>
        <h1>Bibliothèque</h1>
        <nav>
          <Link to="/login">Connexion</Link>
          {' · '}
          <Link to="/register">Créer un compte</Link>
        </nav>
      </main>
    );
  }

  return (
    <main>
      <h1>Bibliothèque</h1>
      <p>Connecté : {session.user.name}</p>
      <p>
        <Link to="/stacks">Stacks</Link>
      </p>
      <button type="button" onClick={signOut}>
        Se déconnecter
      </button>
    </main>
  );
}
