import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Form, Skeleton } from '@heroui/react';
import { authClient, deleteAccount, getMe, type DeleteAccountResult } from '../lib/auth';
import { useAsyncData } from '../lib/useAsyncData';
import { AuthField } from '../components/AuthField';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';

/** Message affiché pour chaque refus du serveur ; `deleted` ne passe jamais ici. */
const REFUSAL_MESSAGES: Record<Exclude<DeleteAccountResult, 'deleted' | 'unauthorized'>, string> = {
  'invalid-password': 'Mot de passe incorrect',
  forbidden: 'Un compte administrateur ne peut pas être supprimé ici',
  'rate-limited': 'Trop de tentatives. Réessayer dans quelques minutes',
};

/**
 * Espace « Mon compte » : identité du compte connecté et suppression en
 * libre-service.
 *
 * La garde est `GET /me` (401 → `/login`), comme les autres écrans
 * d'apprenant. `useSession()` ne sert qu'à afficher le nom et le courriel.
 *
 * La suppression est irréversible, donc en deux temps : un premier bouton
 * déplie le formulaire, puis le mot de passe est redemandé. Le serveur le
 * revérifie ; l'interface n'est qu'une commodité.
 */
export function AccountPage() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data: me, error: meError } = useAsyncData(getMe, [], 'Impossible de vérifier la session');

  useEffect(() => {
    if (me === 'unauthorized') {
      navigate('/login', { replace: true });
    }
  }, [me, navigate]);

  async function handleDelete(form: HTMLFormElement) {
    setError(null);
    setPending(true);

    try {
      const result = await deleteAccount(String(new FormData(form).get('password') ?? ''));

      if (result === 'deleted') {
        // Le cookie est déjà retiré par le serveur ; `useSession()` se met à
        // jour tout seul, il ne reste qu'à quitter cette page.
        navigate('/', { replace: true });
        return;
      }

      if (result === 'unauthorized') {
        navigate('/login', { replace: true });
        return;
      }

      setError(REFUSAL_MESSAGES[result]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de supprimer le compte');
    } finally {
      setPending(false);
    }
  }

  if (meError) {
    return <ErrorMessage>{meError}</ErrorMessage>;
  }

  if (me !== 'ok') {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  return (
    <>
      <PageHeader title="Mon compte" description="Identité du compte et gestion des données." />

      {session?.user ? (
        <dl className="mb-10 grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted">Nom</dt>
          <dd>{session.user.name}</dd>
          <dt className="text-muted">Email</dt>
          <dd>{session.user.email}</dd>
        </dl>
      ) : null}

      <section
        aria-labelledby="delete-account-title"
        className="border-danger/40 rounded-xl border p-5"
      >
        <h2 id="delete-account-title" className="text-danger text-lg font-semibold">
          Supprimer le compte
        </h2>
        <p className="text-muted mt-2 text-sm">
          La suppression est immédiate et définitive. Le compte et toutes ses données sont effacés :
          sessions de connexion, favoris, notes, progression des révisions et résultats de quiz.
          Aucune récupération n’est possible.
        </p>

        {confirming ? (
          <Form
            className="mt-5 flex max-w-sm flex-col gap-4"
            validationBehavior="aria"
            onSubmit={(event) => {
              event.preventDefault();
              void handleDelete(event.currentTarget);
            }}
          >
            <AuthField
              name="password"
              type="password"
              label="Mot de passe (confirmation)"
              autoComplete="current-password"
              isRequired
            />
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="danger" isDisabled={pending}>
                {pending ? 'Suppression…' : 'Supprimer définitivement'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                isDisabled={pending}
                onPress={() => {
                  setConfirming(false);
                  setError(null);
                }}
              >
                Annuler
              </Button>
            </div>
          </Form>
        ) : (
          <Button
            type="button"
            variant="danger-soft"
            className="mt-5"
            onPress={() => setConfirming(true)}
          >
            Supprimer mon compte…
          </Button>
        )}
      </section>
    </>
  );
}
