import { Link } from 'react-router';
import { Card, buttonVariants } from '@heroui/react';
import {
  ArticleIcon,
  ChartLineUpIcon,
  EnvelopeSimpleIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PathIcon,
  QuestionIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { PageHeader } from '../components/ui/PageHeader';
import { authClient } from '../lib/auth';

/** Ce qu'il faut pour utiliser une partie du site, affiché sous chaque bloc. */
const OPEN = 'Accessible sans compte';
const ACCOUNT = 'Compte requis';

/**
 * Chaque bloc décrit la règle d'accès **telle qu'elle est** : le premier module
 * de chaque parcours se lit sans compte, tout le catalogue demande un compte
 * dont l'adresse est vérifiée, et les titres, les résumés et la recherche
 * restent ouverts. Aucune phrase n'annonce un catalogue entièrement lisible
 * sans compte.
 */
const PARTS = [
  {
    title: 'Parcours',
    icon: PathIcon,
    access: 'Plan visible sans compte · premier module lisible sans compte',
    body: 'Un parcours est un plan guidé pour apprendre un métier : des modules ordonnés, chacun composé d’étapes qui mènent à des fiches, quelle que soit leur leçon. Le premier module se lit sans compte, de quoi juger du contenu ; les modules suivants demandent un compte dont l’adresse est vérifiée. L’ordre est un conseil : aucune étape n’attend la précédente.',
  },
  {
    title: 'Leçons',
    icon: StackIcon,
    access: OPEN,
    body: 'Une leçon publiée regroupe des catégories, et chaque catégorie les fiches d’un thème. Les leçons, leurs catégories et la liste de leurs fiches (titre et résumé) se consultent sans compte.',
  },
  {
    title: 'Fiches',
    icon: ArticleIcon,
    access: 'Titre et résumé sans compte · contenu selon la fiche',
    body: 'Le titre et le résumé d’une fiche se lisent toujours. Son contenu (le texte, et pour certaines un atelier de code) se lit sans compte quand la fiche fait partie du premier module d’un parcours. Les autres fiches portent la mention « Compte requis » : leur contenu demande un compte dont l’adresse est vérifiée. Le catalogue ne montre que les fiches publiées.',
  },
  {
    title: 'Recherche',
    icon: MagnifyingGlassIcon,
    access: OPEN,
    body: 'Une fiche publiée se trouve par mot (titre, résumé, étiquette), par format, par niveau ou par leçon. La recherche ne porte pas sur le contenu des fiches. Les brouillons n’apparaissent pas.',
  },
  {
    title: 'Compte et adresse vérifiée',
    icon: EnvelopeSimpleIcon,
    access: ACCOUNT,
    body: 'À la création d’un compte, un message est envoyé à l’adresse indiquée. Le lien qu’il contient, valable une heure, vérifie l’adresse et ouvre tout le catalogue. Tant que l’adresse n’est pas vérifiée, le compte fonctionne sur les fiches lisibles sans compte ; un nouveau message se demande depuis « Mon compte ». L’adresse ne se modifie pas.',
  },
  {
    title: 'Examen',
    icon: QuestionIcon,
    access: ACCOUNT,
    body: 'Un questionnaire de compréhension peut être lancé depuis une fiche lue. Ses questions sont générées automatiquement à partir du contenu de la fiche : elles peuvent comporter des erreurs. Le résultat indique si l’examen est réussi, et la fiche garde le meilleur score. Un compte est nécessaire : sans session, la fiche invite à se connecter. Ce n’est pas un diplôme ni un certificat.',
  },
  {
    title: 'Progression',
    icon: ChartLineUpIcon,
    access: ACCOUNT,
    body: 'Avec un compte, une étape de parcours est validée en réussissant l’examen de sa fiche, ou en lisant la fiche quand elle n’a pas d’examen. L’accueil propose de reprendre un parcours commencé, et les fiches déjà lues ou dont l’examen est réussi portent un repère dans le catalogue. Sans compte, rien n’est enregistré.',
  },
  {
    title: 'Favoris',
    icon: HeartIcon,
    access: ACCOUNT,
    body: 'Une fiche lue peut être mise de côté depuis un compte, puis retrouvée sur l’écran Favoris. Le lien Favoris apparaît alors dans le menu Bibliothèque. Sans compte, aucun bouton n’est visible.',
  },
  {
    title: 'Notes',
    icon: NotePencilIcon,
    access: ACCOUNT,
    body: 'Avec un compte, un texte personnel peut être écrit sur une fiche lue, puis retrouvé sur l’écran Notes. Le lien Notes apparaît alors dans le menu Bibliothèque. Sans compte, aucune zone de note n’est visible.',
  },
] as const;

/**
 * Présentation du produit (US3 / FR-006).
 *
 * Page publique, texte statique : on n’appelle pas l’API. Les blocs
 * décrivent l’offre réelle. Pas de certificats ni notifications — ces outils
 * n’existent pas encore (FR-013).
 *
 * La section « Origine du contenu » dit ce qui est écrit par une personne et
 * ce qui est généré par un programme : c’est une condition de confiance, pas
 * une mention légale.
 */
export function HowItWorksPage() {
  const { data: session, isPending } = authClient.useSession();
  const isSignedIn = Boolean(session?.user);
  return (
    <>
      <PageHeader
        title="À propos"
        description="Bibliothèque d’apprentissage : parcours, leçons, fiches, recherche et examens de compréhension. Cette page décrit l’offre actuelle."
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
                <Card.Footer className="text-muted text-xs">{part.access}</Card.Footer>
              </Card>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="content-origin" className="mb-10 max-w-3xl">
        <h2 id="content-origin" className="text-lg font-semibold tracking-tight">
          Origine du contenu
        </h2>
        <div className="text-muted mt-3 flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            Les fiches sont rédigées à partir de contenus existants, en premier lieu les
            documentations officielles des technologies présentées. Le texte d’origine est
            reformulé, résumé et adapté au format d’une fiche : ce n’est ni une copie, ni un contenu
            original.
          </p>
          <p>
            Chaque fiche cite ses documents d’origine dans un bloc « Sources », placé à la fin de la
            fiche : titre, éditeur, licence, et la mention « Adapté de » quand la fiche reprend ce
            document. Quand elle est renseignée, la date « Vérifié le » indique la dernière
            relecture de la fiche face à sa source.
          </p>
          <p>
            Les questions des examens sont produites par un programme de génération de texte, à
            partir du contenu de la fiche. Personne ne les relit avant qu’elles soient posées : une
            question ou sa correction peut être fausse.
          </p>
          <p>
            Une erreur dans une fiche ou dans un examen se signale par le lien « Signaler une erreur
            », à la fin de chaque fiche, ou par le{' '}
            <Link to="/contact" className="text-foreground underline underline-offset-2">
              formulaire de contact
            </Link>
            .
          </p>
        </div>
      </section>

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
          <Link
            to="/parcours"
            className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
          >
            Suivre un parcours
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
