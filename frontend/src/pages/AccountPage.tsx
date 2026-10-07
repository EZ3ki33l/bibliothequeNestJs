import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Button, Chip, Form, Skeleton } from '@heroui/react';
import { SealCheckIcon, WarningCircleIcon } from '@phosphor-icons/react';
import {
  authClient,
  changePassword,
  deleteAccount,
  getMe,
  updateName,
  type ChangePasswordResult,
  type DeleteAccountResult,
} from '../lib/auth';
import { useAsyncData } from '../lib/useAsyncData';
import { useLoginRedirect } from '../lib/useLoginRedirect';
import { viewerAccess } from '../lib/viewerAccess';
import { VerifyEmailReminder } from '../components/account/VerifyEmailReminder';
import { AuthField } from '../components/AuthField';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';
import { Typo } from '../components/ui/Typo';

/** Message affiché pour chaque refus du serveur ; `deleted` ne passe jamais ici. */
const REFUSAL_MESSAGES: Record<Exclude<DeleteAccountResult, 'deleted' | 'unauthorized'>, string> = {
  'invalid-password': 'Mot de passe incorrect',
  forbidden: 'Un compte administrateur ne peut pas être supprimé ici',
  'rate-limited': 'Trop de tentatives. Réessayer dans quelques minutes',
};

/**
 * Refus d'un changement de mot de passe. « Mot de passe incorrect » ne dit
 * rien d'autre que l'échec : ni si le compte existe ailleurs, ni pourquoi.
 */
const PASSWORD_MESSAGES: Record<Exclude<ChangePasswordResult, 'ok' | 'unauthorized'>, string> = {
  'invalid-password': 'Mot de passe incorrect',
  'password-too-short': 'Le nouveau mot de passe doit contenir au moins 8 caractères',
  'rate-limited': 'Trop de tentatives. Réessayer dans quelques minutes',
};

const NAME_RULE = 'Le nom doit contenir entre 2 et 80 caractères';

const SECTION_CLASS = 'border-border rounded-xl border p-5';

/** Confirmation d'un enregistrement, annoncée aux lecteurs d'écran. */
function SavedNotice({ children }: { children: string }) {
  return (
    <Alert status="success" role="status">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{children}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}

/**
 * Espace « Mon compte » : nom affiché, mot de passe, suppression.
 *
 * La garde est `GET /me` (401 → connexion, en retenant cette page), comme les
 * autres écrans d'apprenant. `useSession()` ne sert qu'à afficher le nom et le
 * courriel.
 *
 * Chaque formulaire n'est qu'une commodité : c'est le serveur qui vérifie.
 * - nom : 2 à 80 caractères, aucun autre champ accepté ;
 * - mot de passe : le mot de passe **actuel** est exigé (une session volée ne
 *   suffit pas à s'approprier le compte), et les autres sessions sont fermées ;
 * - suppression : irréversible, donc en deux temps, mot de passe redemandé.
 *
 * L'adresse électronique est affichée sans champ de saisie : elle identifie le
 * compte et ne se modifie pas. Son état (vérifiée ou à vérifier) est affiché
 * avec un pictogramme **et** un libellé ; tant qu'elle n'est pas vérifiée, le
 * rappel propose de recevoir un nouveau message. Cet état vient de la session
 * et ne sert qu'à l'affichage : c'est le serveur qui ouvre, ou non, les fiches
 * réservées.
 */
export function AccountPage() {
  const navigate = useNavigate();
  const redirectToLogin = useLoginRedirect();
  const { data: session, refetch } = authClient.useSession();

  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [namePending, setNamePending] = useState(false);

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  // Changé après un succès : les champs de mot de passe repartent vides.
  const [passwordFormKey, setPasswordFormKey] = useState(0);

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data: me, error: meError } = useAsyncData(getMe, [], 'Impossible de vérifier la session');

  useEffect(() => {
    if (me === 'unauthorized') {
      redirectToLogin();
    }
  }, [me, redirectToLogin]);

  async function handleName(form: HTMLFormElement) {
    const name = String(new FormData(form).get('name') ?? '').trim();

    setNameError(null);
    setNameSaved(false);

    if (name.length < 2 || name.length > 80) {
      setNameError(NAME_RULE);
      return;
    }

    setNamePending(true);

    try {
      const result = await updateName(name);

      if (result === 'unauthorized') {
        redirectToLogin();
        return;
      }
      if (result === 'invalid-name') {
        setNameError(NAME_RULE);
        return;
      }
      if (result === 'rate-limited') {
        setNameError('Trop de tentatives. Réessayer dans quelques minutes');
        return;
      }

      // Relit la session : le menu affiche le nouveau nom sans rechargement.
      await refetch();
      setNameSaved(true);
    } catch (caught) {
      setNameError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer le nom');
    } finally {
      setNamePending(false);
    }
  }

  async function handlePassword(form: HTMLFormElement) {
    const data = new FormData(form);
    const currentPassword = String(data.get('currentPassword') ?? '');
    const newPassword = String(data.get('newPassword') ?? '');

    setPasswordError(null);
    setPasswordSaved(false);

    if (newPassword.length < 8) {
      setPasswordError(PASSWORD_MESSAGES['password-too-short']);
      return;
    }

    setPasswordPending(true);

    try {
      const result = await changePassword(currentPassword, newPassword);

      if (result === 'unauthorized') {
        redirectToLogin();
        return;
      }
      if (result !== 'ok') {
        setPasswordError(PASSWORD_MESSAGES[result]);
        return;
      }

      setPasswordSaved(true);
      setPasswordFormKey((key) => key + 1);
    } catch (caught) {
      setPasswordError(
        caught instanceof Error ? caught.message : 'Impossible de changer le mot de passe',
      );
    } finally {
      setPasswordPending(false);
    }
  }

  async function handleDelete(form: HTMLFormElement) {
    setError(null);
    setPending(true);

    try {
      const result = await deleteAccount(String(new FormData(form).get('password') ?? ''));

      if (result === 'deleted') {
        // Le cookie est déjà retiré par le serveur ; `useSession()` se met à
        // jour tout seul. L'accueil confirme l'effacement, une seule fois,
        // grâce à l'état de navigation (rien n'apparaît dans l'adresse).
        void navigate('/', { replace: true, state: { accountDeleted: true } });
        return;
      }

      if (result === 'unauthorized') {
        redirectToLogin();
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

  if (me !== 'ok' || !session?.user) {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  const { user } = session;
  const emailVerified = viewerAccess(user) === 'verified';

  return (
    <>
      <PageHeader title="Mon compte" description="Identité du compte et gestion des données." />

      <div className="card-grid grid items-start gap-8 [--card-min:26rem]">
        <section aria-labelledby="account-name-title" className={SECTION_CLASS}>
          <Typo variant="h3" as="h2" id="account-name-title">
            Nom affiché
          </Typo>
          <Typo variant="small" as="p" className="mt-2">
            Le nom apparaît dans le menu. Il n’est visible que de son titulaire.
          </Typo>
          {/* `key` : après un enregistrement, le champ repart du nom en vigueur. */}
          <Form
            key={user.name}
            className="mt-5 flex max-w-sm flex-col gap-4"
            validationBehavior="aria"
            onSubmit={(event) => {
              event.preventDefault();
              void handleName(event.currentTarget);
            }}
          >
            <AuthField
              name="name"
              label="Nom"
              autoComplete="name"
              isRequired
              minLength={2}
              maxLength={80}
              defaultValue={user.name}
              description="2 à 80 caractères."
            />
            {nameError ? <ErrorMessage>{nameError}</ErrorMessage> : null}
            {nameSaved ? <SavedNotice>Nom enregistré.</SavedNotice> : null}
            <div>
              <Button type="submit" variant="primary" isDisabled={namePending}>
                {namePending ? 'Enregistrement…' : 'Enregistrer le nom'}
              </Button>
            </div>
          </Form>
        </section>

        <section aria-labelledby="account-email-title" className={SECTION_CLASS}>
          <Typo variant="h3" as="h2" id="account-email-title">
            Adresse électronique
          </Typo>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Typo variant="small" as="p" className="text-foreground min-w-0 wrap-break-word">
              {user.email}
            </Typo>
            {emailVerified ? (
              <Chip size="sm" variant="soft" color="success">
                <span className="inline-flex items-center gap-1">
                  <SealCheckIcon aria-hidden="true" weight="fill" className="size-3.5" />
                  Adresse vérifiée
                </span>
              </Chip>
            ) : (
              <Chip size="sm" variant="soft" color="warning">
                <span className="inline-flex items-center gap-1">
                  <WarningCircleIcon aria-hidden="true" weight="fill" className="size-3.5" />
                  Adresse à vérifier
                </span>
              </Chip>
            )}
          </div>
          <Typo variant="small" as="p" className="mt-2">
            L’adresse identifie le compte et ne peut pas être modifiée.
            {emailVerified
              ? ' Vérifiée, elle ouvre tout le catalogue.'
              : ' Une adresse mal saisie se corrige en supprimant ce compte, puis en en créant un autre.'}
          </Typo>
          {emailVerified ? null : (
            <div className="border-border mt-4 border-t pt-4">
              <Typo variant="small" as="p" className="mb-3">
                Tant qu’elle n’est pas vérifiée, seul le premier module de chaque parcours se lit.
                Le lien reçu par message ouvre tout le catalogue.
              </Typo>
              <VerifyEmailReminder email={user.email} returnTo="/compte" />
            </div>
          )}
        </section>

        <section aria-labelledby="account-password-title" className={SECTION_CLASS}>
          <Typo variant="h3" as="h2" id="account-password-title">
            Mot de passe
          </Typo>
          <Typo variant="small" as="p" className="mt-2">
            Le mot de passe actuel est demandé pour confirmer le changement. Les autres sessions du
            compte sont alors fermées ; celle-ci reste ouverte.
          </Typo>
          <Form
            key={passwordFormKey}
            className="mt-5 flex max-w-sm flex-col gap-4"
            validationBehavior="aria"
            onSubmit={(event) => {
              event.preventDefault();
              void handlePassword(event.currentTarget);
            }}
          >
            {/* Champ masqué mais présent : il dit au gestionnaire de mots de
                passe à quel compte rattacher le nouveau mot de passe. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              defaultValue={user.email}
              readOnly
              hidden
            />
            <AuthField
              name="currentPassword"
              type="password"
              label="Mot de passe actuel"
              autoComplete="current-password"
              isRequired
            />
            <AuthField
              name="newPassword"
              type="password"
              label="Nouveau mot de passe"
              autoComplete="new-password"
              isRequired
              minLength={8}
              description="8 caractères au moins."
            />
            {passwordError ? <ErrorMessage>{passwordError}</ErrorMessage> : null}
            {passwordSaved ? (
              <SavedNotice>Mot de passe changé. Les autres sessions sont fermées.</SavedNotice>
            ) : null}
            <div>
              <Button type="submit" variant="primary" isDisabled={passwordPending}>
                {passwordPending ? 'Enregistrement…' : 'Changer le mot de passe'}
              </Button>
            </div>
          </Form>
        </section>

        <section
          aria-labelledby="delete-account-title"
          className="border-danger/40 rounded-xl border p-5"
        >
          <Typo variant="h3" as="h2" id="delete-account-title" className="text-cherry-light">
            Supprimer le compte
          </Typo>
          <Typo variant="small" as="p" className="mt-2">
            La suppression est immédiate et définitive. Le compte et toutes ses données sont effacés
            : sessions de connexion, favoris, notes, fiches lues et résultats d’examen. Aucune
            récupération n’est possible.
          </Typo>

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
      </div>
    </>
  );
}
