import { Link } from 'react-router';
import { Card, buttonVariants } from '@heroui/react';
import { MagnifyingGlassIcon, QuestionIcon, StackIcon } from '@phosphor-icons/react';
import { authClient } from '../lib/auth';

/**
 * Portes d'entrée de l'accueil : une carte par usage distinct du site.
 *
 * L'accueil oriente, il ne rejoue pas le catalogue : la grille des stacks vit
 * sur `/stacks`, la liste des fiches sur `/recherche`. Dupliquer l'une des deux
 * ici rendait l'accueil, `/stacks` et `/recherche` indistinguables.
 */
const DOORS = [
  {
    to: '/stacks',
    icon: StackIcon,
    title: 'Parcourir les stacks',
    body: 'Le catalogue se parcourt par parcours, puis par catégorie. Sans compte.',
  },
  {
    to: '/recherche',
    icon: MagnifyingGlassIcon,
    title: 'Rechercher une fiche',
    body: 'Recherche par titre, résumé ou étiquette, sans parcourir tout l’arbre.',
  },
  {
    to: '/a-propos',
    icon: QuestionIcon,
    title: 'À propos',
    body: 'Présentation de l’offre : parcours, fiches, examen, révisions.',
  },
] as const;

/**
 * Accueil public (orientation).
 *
 * Rôle : dire ce qu'est le site et ouvrir ses trois usages (parcourir,
 * chercher, comprendre). Il n'appelle plus l'API — aucune grille de catalogue
 * ici, donc rien à charger : un `GET /stacks` en panne ne casse pas la landing.
 * `useSession` ne décide que du CTA de compte, ce n'est pas une garde d'accès.
 *
 * La *hero* porte le `<h1>` de la page : on n'utilise donc pas `PageHeader`
 * ici (un seul `h1` par page). Couleurs : uniquement des tokens (`bg-surface`,
 * `text-brand`…), jamais de valeur en dur, pour rester cohérent avec le thème.
 */
export function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  const isSignedIn = Boolean(session?.user);

  return (
    <>
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
            Des parcours (stacks) à explorer, des fiches à lire, des examens de compréhension et des
            révisions espacées. Le catalogue se parcourt sans compte ; un compte ouvre examens et
            révisions.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/stacks" className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
              Parcourir le catalogue
            </Link>
            {isPending ? null : isSignedIn ? (
              <Link
                to="/review"
                className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
              >
                Révisions
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

      <section aria-labelledby="home-doors-heading">
        <h2 id="home-doors-heading" className="mb-4 text-lg font-semibold tracking-tight">
          Vue d’ensemble
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
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
                      <Card.Description>{door.body}</Card.Description>
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
