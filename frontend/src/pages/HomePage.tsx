import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert, Card, buttonVariants } from '@heroui/react';
import { MagnifyingGlassIcon, PathIcon, QuestionIcon, StackIcon } from '@phosphor-icons/react';
import { authClient, type VerificationRequestResult } from '../lib/auth';
import { usePageTitle } from '../lib/pageTitle';
import { LearnerHome } from '../components/home/LearnerHome';

/**
 * Portes d'entrée de l'accueil : une carte par usage distinct du site.
 *
 * L'accueil oriente, il ne rejoue pas le catalogue : la grille des stacks vit
 * sur `/stacks`, la liste des fiches sur `/recherche`. Dupliquer l'une des deux
 * ici rendait l'accueil, `/stacks` et `/recherche` indistinguables.
 *
 * `guestNote` ne s'adresse qu'à un visiteur : il dit ce qui se lit sans compte.
 * Il décrit la règle telle qu'elle est (le premier module de chaque parcours,
 * les titres et les résumés), jamais un catalogue entièrement ouvert.
 */
const DOORS = [
  {
    to: '/parcours',
    icon: PathIcon,
    title: 'Suivre un parcours',
    body: 'Un plan guidé qui ordonne les fiches pour apprendre un métier, étape par étape.',
    guestNote: 'Le premier module se lit sans compte.',
  },
  {
    to: '/stacks',
    icon: StackIcon,
    title: 'Parcourir les leçons',
    body: 'Le catalogue se parcourt par leçons, puis par catégorie.',
    guestNote: 'Titres et résumés sans compte.',
  },
  {
    to: '/recherche',
    icon: MagnifyingGlassIcon,
    title: 'Rechercher une fiche',
    body: 'Recherche par titre, résumé ou étiquette, sans parcourir tout l’arbre.',
    guestNote: null,
  },
  {
    to: '/a-propos',
    icon: QuestionIcon,
    title: 'À propos',
    body: 'Présentation de l’offre : parcours, leçons, fiches, examens, progression.',
    guestNote: null,
  },
] as const;

/** Messages d'arrivée, portés par l'état de navigation (`navigate(…, { state })`). */
type Arrival = {
  accountCreated: boolean;
  accountDeleted: boolean;
  /** Issue de la demande du message de vérification, faite à l'inscription. */
  verification: VerificationRequestResult | null;
  /** Adresse du compte créé, pour la nommer dans le message de bienvenue. */
  email: string | null;
};

const VERIFICATION_RESULTS: readonly VerificationRequestResult[] = [
  'sent',
  'already-verified',
  'rate-limited',
  'unavailable',
  'unauthorized',
];

/**
 * Lit l'état de navigation sans lui faire confiance : `location.state` est de
 * type inconnu. Seul le booléen `true` compte, l'issue de l'envoi doit être une
 * valeur connue, et l'adresse une chaîne de longueur raisonnable (elle n'est
 * qu'affichée, comme du texte).
 */
function readArrival(state: unknown): Arrival {
  const flags =
    typeof state === 'object' && state !== null ? (state as Record<string, unknown>) : {};
  const verification = VERIFICATION_RESULTS.find((result) => result === flags.verification);

  return {
    accountCreated: flags.accountCreated === true,
    accountDeleted: flags.accountDeleted === true,
    verification: verification ?? null,
    email: typeof flags.email === 'string' && flags.email.length <= 320 ? flags.email : null,
  };
}

/**
 * Accueil (orientation).
 *
 * Rôle : dire ce qu'est le site et ouvrir ses usages (suivre un parcours,
 * parcourir, chercher, comprendre). Pour un **visiteur**, la page n'appelle pas
 * l'API : un catalogue en panne ne casse pas l'accueil. Pour un **compte
 * connecté**, `LearnerHome` ajoute ce qui le concerne (reprendre un parcours,
 * par où commencer) par une lecture sous session ; si elle échoue, les accès
 * d'orientation restent seuls.
 *
 * `useSession` ne décide que de l'affichage, ce n'est pas une garde d'accès :
 * c'est le serveur qui renvoie, ou non, les données du compte.
 *
 * La *hero* porte le `<h1>` de la page : on n'utilise donc pas `PageHeader`
 * ici (un seul `h1` par page). Couleurs : uniquement des tokens (`bg-surface`,
 * `text-brand`…), jamais de valeur en dur, pour rester cohérent avec le thème.
 */
export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const isSignedIn = Boolean(session?.user);

  // L'accueil porte le nom du site seul.
  usePageTitle();

  /**
   * Bienvenue après une inscription, confirmation après une suppression de
   * compte : affichées **une fois**.
   *
   * L'état de navigation n'apparaît pas dans l'adresse (un lien ne peut pas
   * provoquer le message), mais le navigateur le conserve dans son historique,
   * rechargement compris. Il est donc recopié ici à l'arrivée, puis effacé de
   * l'historique : un rechargement ou un retour arrière ne le rejoue pas.
   */
  const [arrival] = useState(() => readArrival(location.state));

  useEffect(() => {
    if (location.state !== null) {
      void navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.state, location.pathname, location.search, navigate]);

  return (
    <>
      {/* Bienvenue, avec l'issue de l'envoi du message de vérification. Un
          envoi en échec est dit tel quel (le compte existe, son adresse reste à
          vérifier) : le rappel affiché plus bas propose un nouvel envoi. */}
      {arrival.accountCreated ? (
        arrival.verification !== null && arrival.verification !== 'sent' ? (
          <Alert status="warning" className="mb-8">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Compte créé.</Alert.Title>
              <Alert.Description>
                Le message de vérification n’a pas pu être envoyé
                {arrival.email ? (
                  <>
                    {' '}
                    à <span className="wrap-break-word">{arrival.email}</span>
                  </>
                ) : null}
                . Un nouvel envoi se demande plus bas sur cette page, ou depuis « Mon compte ». En
                attendant, le premier module de chaque parcours se lit déjà.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <Alert status="success" className="mb-8">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Compte créé.</Alert.Title>
              <Alert.Description>
                {arrival.verification === 'sent' && arrival.email ? (
                  <>
                    Un message a été envoyé à{' '}
                    <span className="wrap-break-word">{arrival.email}</span> : le lien qu’il
                    contient ouvre tout le catalogue.{' '}
                  </>
                ) : null}
                Pour commencer : choisir un parcours ci-dessous et ouvrir sa première étape.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )
      ) : null}

      {arrival.accountDeleted ? (
        <Alert status="success" className="mb-8">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Le compte et ses données ont été effacés.</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      <section className="border-border bg-surface relative mb-12 overflow-hidden rounded-3xl border px-6 py-16 sm:px-12 sm:py-20">
        {/* Halo de marque : purement décoratif, donc masqué aux lecteurs d'écran. */}
        <div
          aria-hidden
          className="bg-brand/20 pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl"
        />

        <div className="relative max-w-2xl">
          <p className="text-brand mb-4 text-xs font-semibold tracking-[0.2em] uppercase">
            Bibliothèque d’apprentissage
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Apprendre par <span className="text-brand">parcours</span> et fiches.
          </h1>

          <p className="text-muted mt-5 text-base leading-relaxed sm:text-lg">
            Des parcours guidés à suivre, des leçons à explorer, des fiches à lire et des examens de
            compréhension.
            {/* La mention du compte ne s'adresse qu'à qui n'en a pas. */}
            {isPending || isSignedIn
              ? null
              : ' Le premier module de chaque parcours se lit sans compte ; un compte dont l’adresse est vérifiée ouvre tout le catalogue, les examens, le suivi des parcours, les favoris et les notes.'}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/stacks" className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
              Parcourir le catalogue
            </Link>
            {isPending ? null : isSignedIn ? (
              <Link
                to="/parcours"
                className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
              >
                Suivre un parcours
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
                >
                  Créer un compte
                </Link>
                <Link
                  to="/login"
                  className="text-muted hover:text-foreground px-2 text-sm no-underline transition-colors duration-150"
                >
                  Connexion
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Bloc personnel, au-dessus des accès d'orientation. Rendu seulement si
          la session du navigateur annonce un compte : un visiteur n'émet
          aucune requête sous session. */}
      {isSignedIn ? <LearnerHome /> : null}

      <section aria-labelledby="home-doors-heading">
        <h2 id="home-doors-heading" className="mb-4 text-lg font-semibold tracking-tight">
          Vue d’ensemble
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {DOORS.map((door) => {
            const Icon = door.icon;

            return (
              <li key={door.to}>
                <Link to={door.to} className="block h-full no-underline">
                  <Card className="hover:bg-surface-hover h-full transition-colors duration-150">
                    <Card.Header>
                      <Card.Title className="flex items-center gap-2">
                        <Icon className="text-muted size-4" />
                        {door.title}
                      </Card.Title>
                      <Card.Description>
                        {door.body}
                        {door.guestNote && !isPending && !isSignedIn ? ` ${door.guestNote}` : null}
                      </Card.Description>
                    </Card.Header>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
