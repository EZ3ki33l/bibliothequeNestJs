import { Link } from 'react-router';
import { Card, buttonVariants } from '@heroui/react';
import {
  ArticleIcon,
  CardsIcon,
  MagnifyingGlassIcon,
  QuestionIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { PageHeader } from '../components/ui/PageHeader';
import { authClient } from '../lib/auth';

const PARTS = [
  {
    title: 'Parcours (stacks)',
    icon: StackIcon,
    account: false,
    body: 'Un parcours publié regroupe des catégories. Il figure dans le catalogue, sans compte. Chaque catégorie contient les fiches d’un thème.',
  },
  {
    title: 'Fiches',
    icon: ArticleIcon,
    account: false,
    body: 'Une fiche s’ouvre dans son parcours. Le texte se lit sur la page ; certaines fiches proposent aussi un atelier de code. Le catalogue public ne montre que les fiches publiées.',
  },
  {
    title: 'Recherche',
    icon: MagnifyingGlassIcon,
    account: false,
    body: 'Une fiche publiée se trouve par mot (titre, résumé, étiquette), par format, par niveau ou par parcours. Sans compte. Les brouillons n’apparaissent pas.',
  },
  {
    title: 'Examen',
    icon: QuestionIcon,
    account: true,
    body: 'Un questionnaire de compréhension peut être lancé depuis une fiche. Un compte est nécessaire : sans session, la navigation bascule vers la connexion. Ce n’est pas un diplôme ni un certificat.',
  },
  {
    title: 'Révisions',
    icon: CardsIcon,
    account: true,
    body: 'Avec un compte, les fiches lues reviennent plus tard, selon ce qui a été retenu. Le lien Révisions apparaît alors dans le menu Bibliothèque. Sans compte, cette partie n’est pas disponible.',
  },
] as const;

/**
 * Présentation du produit (US3 / FR-006).
 *
 * Page publique, texte statique : on n’appelle pas l’API. Les blocs
 * décrivent l’offre réelle. Pas de favoris, certificats ni notifications —
 * ces outils n’existent pas encore (FR-013).
 */
export function HowItWorksPage() {
  const { data: session, isPending } = authClient.useSession();
  const isSignedIn = Boolean(session?.user);
  return (
    <>
      <PageHeader
        title="À propos"
        description="Bibliothèque d’apprentissage : parcours, fiches, recherche, examens de compréhension et révisions espacées. Cette page décrit l’offre actuelle."
      />

      <ul className="mb-10 grid list-none gap-4 p-0">
        {PARTS.map((part) => {
          const Icon = part.icon;

          return (
            <li key={part.title}>
              <Card>
                <Card.Header>
                  <Card.Title className="flex items-center gap-2">
                    <Icon className="text-muted size-4" />
                    {part.title}
                  </Card.Title>
                  <Card.Description>{part.body}</Card.Description>
                </Card.Header>
                <Card.Footer className="text-muted text-xs">
                  {part.account ? 'Compte requis' : 'Accessible sans compte'}
                </Card.Footer>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Link to="/stacks" className={`${buttonVariants({ variant: 'primary' })} no-underline`}>
          Parcourir le catalogue
        </Link>
        <Link
          to="/recherche"
          className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
        >
          Rechercher une fiche
        </Link>
        {isPending ? null : isSignedIn ? (
          <Link to="/review" className={`${buttonVariants({ variant: 'secondary' })} no-underline`}>
            Révisions
          </Link>
        ) : (
          <Link
            to="/register"
            className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
          >
            Créer un compte
          </Link>
        )}
      </div>
    </>
  );
}
