import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert, Card, buttonVariants } from '@heroui/react';
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PathIcon,
  QuestionIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { authClient, type VerificationRequestResult } from '../lib/auth';
import { usePageTitle } from '../lib/pageTitle';
import { LearnerHome } from '../components/home/LearnerHome';
import { Typo } from '../components/ui/Typo';

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

/**
 * Les trois temps d'une étape de parcours, illustrés dans la hero.
 *
 * C'est une suite ordonnée, d'où la liste numérotée. Aucun seuil ni chiffre
 * n'est écrit ici : le serveur seul connaît la note qui valide un examen.
 */
const STEP_TIMES = [
  { title: 'Lire la fiche', body: 'Une notion, son explication et ses sources.' },
  { title: 'Manipuler le code', body: 'Un atelier modifiable accompagne les fiches pratiques.' },
  { title: 'Passer l’examen', body: 'Un examen réussi valide l’étape du parcours.' },
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
 * ici (un seul `h1` par page). Couleurs : uniquement des tokens et les teintes
 * de la charte (`bg-surface`, `border-blueberry`…), jamais de valeur en dur.
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

      {/* Hero sans cadre : le titre porte la page. À droite, les trois temps
          d'une étape de parcours, dessinés comme les étapes réelles de
          `PathPage` : c'est ce que le site fait, montré plutôt que décrit. */}
      <section className="3xl:grid-cols-[minmax(0,1fr)_32rem] 3xl:gap-20 mb-14 grid items-center gap-10 pt-2 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14 lg:pt-8 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0">
          <Typo variant="h1" className="3xl:text-7xl lg:text-6xl">
            Apprendre par parcours et fiches.
          </Typo>

          <Typo variant="lead" className="3xl:text-xl mt-5 max-w-[56ch]">
            Des parcours guidés à suivre, des leçons à explorer, des fiches à lire et des examens de
            compréhension.
            {/* La mention du compte ne s'adresse qu'à qui n'en a pas. */}
            {isPending || isSignedIn
              ? null
              : ' Le premier module de chaque parcours se lit sans compte ; un compte dont l’adresse est vérifiée ouvre tout le catalogue, les examens, le suivi des parcours, les favoris et les notes.'}
          </Typo>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {/* Action principale de l'écran (Cherry), la seule de l'accueil :
                elle ne dépend pas de la session, donc ne change pas de couleur
                pendant que celle-ci se charge. */}
            <Link
              to="/stacks"
              className={`${buttonVariants({ variant: 'primary' })} cta no-underline`}
            >
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
                  className="text-blueberry-light px-2 text-sm no-underline underline-offset-4 hover:underline"
                >
                  Connexion
                </Link>
              </>
            )}
          </div>
        </div>

        <ol aria-label="Les trois temps d’une étape" className="flex flex-col gap-3">
          {STEP_TIMES.map((time, index) => (
            <li
              key={time.title}
              className={`flex items-start gap-4 rounded-xl border p-4 ${
                index === 1 ? 'border-blueberry bg-blueberry/10' : 'border-border'
              }`}
            >
              {index === 0 ? (
                <CheckCircleIcon
                  aria-hidden="true"
                  weight="fill"
                  className="text-success size-8 shrink-0"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`font-heading flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    index === 1 ? 'bg-blueberry text-blacksea-dark' : 'bg-surface text-muted'
                  }`}
                >
                  {index + 1}
                </span>
              )}
              <div className="min-w-0">
                <Typo variant="small" as="p" className="text-foreground font-medium">
                  {time.title}
                </Typo>
                <Typo variant="caption" className="mt-0.5">
                  {time.body}
                </Typo>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Bloc personnel, au-dessus des accès d'orientation. Rendu seulement si
          la session du navigateur annonce un compte : un visiteur n'émet
          aucune requête sous session. */}
      {isSignedIn ? <LearnerHome /> : null}

      <section aria-labelledby="home-doors-heading">
        <Typo variant="h3" as="h2" id="home-doors-heading" className="mb-4">
          Vue d’ensemble
        </Typo>
        <ul className="card-grid grid gap-4">
          {DOORS.map((door) => {
            const Icon = door.icon;

            return (
              <li key={door.to}>
                <Link to={door.to} className="block h-full no-underline">
                  <Card className="card-interactive h-full">
                    <Card.Header>
                      <Card.Title className="flex items-center gap-2">
                        <Icon aria-hidden="true" className="text-blueberry-light size-4 shrink-0" />
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
