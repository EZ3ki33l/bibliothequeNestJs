import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button, Form, toast } from '@heroui/react';
import { authClient, sendVerificationEmail } from '../lib/auth';
import { loginHref, safeReturnTo } from '../lib/returnTo';
import { AuthField } from '../components/AuthField';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';
import { Typo } from '../components/ui/Typo';

/** Messages des refus connus de l'inscription ; les autres restent généraux. */
function signUpMessage(error: { status?: number; code?: string }): string {
  if (error.status === 429) return 'Trop de tentatives. Réessayer dans quelques minutes.';
  if (error.code === 'PASSWORD_TOO_SHORT') {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (error.code === 'PASSWORD_TOO_LONG') return 'Le mot de passe est trop long.';
  if (error.code === 'INVALID_EMAIL') return 'L’adresse électronique n’est pas valide.';
  if (
    error.code === 'USER_ALREADY_EXISTS' ||
    error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
  ) {
    return 'Cette adresse ne peut pas être utilisée pour créer un compte.';
  }

  return 'Impossible de créer le compte. Vérifier les champs saisis.';
}

const NAME_RULE = 'Le nom doit contenir entre 2 et 80 caractères.';

/**
 * Inscription par courriel (better-auth).
 *
 * Page publique. Le mot de passe ne transite jamais par Nest : better-auth
 * le hash côté serveur. Les liens CGU / confidentialité pointent vers les
 * pages de confiance déjà publiées — on n'invente pas de case à cocher
 * (pas d'endpoint qui stockerait un consentement).
 *
 * Comme la connexion, la page suit `?retour=` après une inscription réussie,
 * toujours à travers `safeReturnTo` (chemin interne seulement).
 *
 * Le compte créé, la page demande aussitôt le **message de vérification** de
 * l'adresse, et dit ce qu'il en est : parti, ou non. C'est une seconde requête,
 * sous la session que l'inscription vient d'ouvrir : le serveur n'envoie rien
 * sans session, et jamais à une autre adresse que celle du compte. Un envoi en
 * échec ne défait pas l'inscription : le compte existe, son adresse reste à
 * vérifier, et un nouvel envoi se demande depuis l'accueil ou « Mon compte ».
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const destination = safeReturnTo(searchParams.get('retour'));
  const { data: session } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Suspendue pendant l'envoi : dès que l'inscription aboutit, la session
  // apparaît, alors que la demande du message de vérification est encore en
  // cours. Cette redirection devancerait la navigation ci-dessous, qui porte le
  // message de bienvenue et l'issue de l'envoi.
  if (session?.user && !pending) {
    return <Navigate to={destination} replace />;
  }

  async function handleSubmit(form: HTMLFormElement) {
    setError(null);
    setPending(true);

    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();

    // Aide à la saisie : le même contrôle est refait par le serveur, qui seul
    // fait foi (une requête forgée ne passe pas par ce formulaire).
    if (name.length < 2 || name.length > 80) {
      setPending(false);
      setError(NAME_RULE);
      return;
    }

    const email = String(data.get('email') ?? '').trim();

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password: String(data.get('password') ?? ''),
    });

    if (signUpError) {
      setPending(false);
      setError(signUpMessage(signUpError));
      return;
    }

    // Le lien du message ramènera à la page d'où l'inscription est partie.
    const verification = await sendVerificationEmail(email, destination);

    // `pending` reste vrai jusqu'à la navigation (voir plus haut). Le toast dit
    // ce qu'il en est où que mène la destination ; l'accueil affiche en plus le
    // message de bienvenue, grâce à l'état de navigation.
    if (verification === 'sent') {
      toast.success(`Compte créé. Un message a été envoyé à ${email}.`);
    } else {
      toast.warning('Compte créé. Le message de vérification n’a pas pu être envoyé.');
    }

    void navigate(destination, {
      replace: true,
      state: { accountCreated: true, verification, email },
    });
  }

  return (
    <>
      <PageHeader
        title="Créer un compte"
        description="Une fois son adresse vérifiée, un compte ouvre tout le catalogue, les examens, le suivi des parcours, les favoris et les notes. Le premier module de chaque parcours se lit sans compte."
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
          name="name"
          label="Nom"
          autoComplete="name"
          isRequired
          minLength={2}
          maxLength={80}
        />
        <AuthField
          name="email"
          type="email"
          label="Email"
          description="Un lien de vérification y est envoyé : l’adresse doit être consultable, elle ne se modifie pas ensuite."
          autoComplete="email"
          isRequired
        />
        <AuthField
          name="password"
          type="password"
          label="Mot de passe"
          description="8 caractères au moins."
          autoComplete="new-password"
          isRequired
          minLength={8}
        />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <Button type="submit" variant="primary" className="cta" isDisabled={pending}>
          {pending ? 'Création…' : 'Créer le compte'}
        </Button>
      </Form>
      <Typo variant="caption" className="mt-6 leading-relaxed">
        La création d’un compte vaut acceptation des{' '}
        <Link to="/cgu" className="text-blueberry-light underline underline-offset-2">
          conditions d’utilisation
        </Link>{' '}
        et la{' '}
        <Link to="/confidentialite" className="text-blueberry-light underline underline-offset-2">
          politique de confidentialité
        </Link>
        .
      </Typo>
      <Typo variant="small" as="p" className="mt-4">
        Déjà un compte ?{' '}
        <Link
          to={loginHref(destination)}
          className="text-blueberry-light underline underline-offset-2"
        >
          Se connecter
        </Link>
      </Typo>
    </>
  );
}
