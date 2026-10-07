import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button, Form } from '@heroui/react';
import { authClient } from '../lib/auth';
import { registerHref, safeReturnTo } from '../lib/returnTo';
import { AuthField } from '../components/AuthField';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';
import { Typo } from '../components/ui/Typo';

/**
 * Connexion par courriel (better-auth).
 *
 * Page publique : pas de `SessionGuard`. Un échec affiche un message
 * générique — on ne dit pas si le courriel existe (énumération de comptes).
 *
 * `?retour=` porte la page demandée avant la connexion. Ce paramètre est
 * lisible et modifiable par n'importe qui (un lien forgé peut l'avoir écrit) :
 * il passe par `safeReturnTo` **au moment de naviguer**, qui ne garde qu'un
 * chemin interne au site. Une destination externe ou mal formée mène à
 * l'accueil.
 *
 * Déjà connecté : redirection vers cette même destination, le formulaire ne
 * servirait à rien. Ce n'est pas une garde d'accès, seulement de l'interface.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const destination = safeReturnTo(searchParams.get('retour'));
  const { data: session } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session?.user) {
    return <Navigate to={destination} replace />;
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
      // 429 : trop de tentatives depuis cette adresse. Le dire évite de faire
      // croire à un mot de passe faux ; cela ne révèle rien sur le compte.
      setError(
        signInError.status === 429
          ? 'Trop de tentatives. Réessayer dans quelques minutes.'
          : 'Email ou mot de passe incorrect',
      );
      return;
    }

    // `replace` : la page de connexion ne reste pas dans l'historique.
    void navigate(destination, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Connexion"
        description="Un compte dont l’adresse est vérifiée ouvre tout le catalogue, les examens, le suivi des parcours, les favoris et les notes. Le premier module de chaque parcours se lit sans compte."
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
        <Link
          to="/mot-de-passe-oublie"
          className="text-muted hover:text-foreground -mt-2 self-end text-sm no-underline transition-colors duration-150"
        >
          Mot de passe oublié ?
        </Link>
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <Button type="submit" variant="primary" className="cta" isDisabled={pending}>
          {pending ? 'Connexion…' : 'Se connecter'}
        </Button>
      </Form>
      <Typo variant="small" as="p" className="mt-6">
        Pas encore de compte ?{' '}
        {/* La destination suit vers l'inscription : elle ne se perd pas en
            changeant d'avis. */}
        <Link
          to={registerHref(destination)}
          className="text-blueberry-light underline underline-offset-2"
        >
          Créer un compte
        </Link>
      </Typo>
    </>
  );
}
