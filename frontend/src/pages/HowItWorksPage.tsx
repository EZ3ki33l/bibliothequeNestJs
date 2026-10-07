import { Link } from 'react-router';
import { Card, buttonVariants } from '@heroui/react';
import {
  ArticleIcon,
  ChartLineUpIcon,
  EnvelopeSimpleIcon,
  GithubLogoIcon,
  HeartIcon,
  LinkedinLogoIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PathIcon,
  QuestionIcon,
  StackIcon,
} from '@phosphor-icons/react';
import posterUrl from '../assets/presentation-poster.jpg';
import { PageHeader } from '../components/ui/PageHeader';
import { authClient } from '../lib/auth';
import { SITE_LEGAL } from '../lib/site-legal';
import { Typo } from '../components/ui/Typo';

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
 * Profils publics de l'auteur. Les adresses sont écrites ici, jamais lues d'une
 * saisie ni de l'API : aucun lien de cette page ne peut être détourné.
 */
const AUTHOR_LINKS = [
  { label: 'GitHub', href: 'https://github.com/EZ3ki33l', icon: GithubLogoIcon },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/romain-rousset-100bb8114/',
    icon: LinkedinLogoIcon,
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
 *
 * La vidéo est un fichier du site (`public/presentation.mp4`), pas un lecteur
 * tiers : aucune requête ne part vers un autre service. `preload="none"` : ses
 * 5 Mo ne sont téléchargés qu'à la lecture, l'image d'attente suffit avant.
 * Elle ne démarre jamais seule, et ses sous-titres sont incrustés à l'image.
 * L'image d'attente est le panneau sombre de la vidéo, sans ses bandes
 * blanches ; le fond du lecteur (`bg-background`) comble les côtés. Elle est
 * importée (`src/assets`) et non posée dans `public/` : son adresse porte une
 * empreinte, donc une image remplacée n'est jamais servie depuis un cache.
 *
 * Les sections « Origine du contenu » et « Qui a créé ce site » accompagnent la
 * vidéo, qui parle de l'une et de l'autre : sous elle jusqu'à `xl`, à côté
 * ensuite (à `lg`, la barre latérale laisse 45rem au contenu, trop peu pour
 * deux colonnes). L'ordre dans la page ne change pas, seul le placement change.
 * À deux colonnes, un même panneau réunit la vidéo et son texte. La vidéo y
 * reste en haut et suit le défilement tant que le texte est nettement plus
 * haut qu'elle ; à partir de `3xl` les deux hauteurs sont proches, elle est
 * alors centrée.
 * « Qui a créé ce site » reprend le nom des mentions légales (`SITE_LEGAL`) :
 * il n'est écrit qu'à un seul endroit.
 *
 * Les deux logos (celui du site, retourné en miroir pour faire face à l'autre,
 * et celui de la société de l'auteur) sont centrés au-dessus de la vidéo, dans
 * la même colonne qu'elle : ils en suivent donc la largeur à toutes les tailles
 * d'écran. Ce sont des fichiers de `public/`,
 * blancs ou clairs sur fond transparent : le site n'a qu'un thème sombre.
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

      <div className="xl:bg-surface 3xl:items-center mb-10 grid gap-x-10 gap-y-8 xl:grid-cols-2 xl:items-start xl:rounded-3xl xl:p-8">
        <div className="max-w-3xl xl:sticky xl:top-8 xl:max-w-none">
          <div className="mb-5 flex items-center justify-center gap-5">
            <img
              src="/ez3learn-logo-fond-transparent.svg"
              alt="Logo EZ3Learn"
              width={700}
              height={730}
              className="h-16 w-auto -scale-x-100"
            />
            <span aria-hidden className="bg-border h-12 w-px" />
            <img
              src="/EZ3_logo_white.png"
              alt="Logo EZ3"
              width={730}
              height={730}
              className="h-16 w-auto"
            />
          </div>
          <figure>
            <video
              controls
              playsInline
              preload="none"
              poster={posterUrl}
              width={1280}
              height={720}
              aria-label="Présentation du site en vidéo"
              className="border-border bg-background aspect-video h-auto w-full rounded-xl border"
            >
              <source src="/presentation.mp4" type="video/mp4" />
              <a href="/presentation.mp4">Télécharger la vidéo de présentation (MP4)</a>
            </video>
            <figcaption className="mt-2">
              <Typo variant="caption">
                Présentation du site en 44 secondes, sous-titres incrustés à l’image. Vidéo générée
                avec HeyGen : la voix et l’animation sont produites par un programme.
              </Typo>
            </figcaption>
          </figure>
        </div>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="site-author" className="max-w-3xl">
            <Typo variant="h3" as="h2" id="site-author">
              Qui a créé ce site
            </Typo>
            <div className="text-muted mt-4 flex flex-col gap-3 text-sm leading-relaxed">
              <Typo variant="p">
                Ce site est conçu et développé par {SITE_LEGAL.publisherName}, alias EZ3ki33l.
              </Typo>
              <Typo variant="p">
                Le projet accompagne une reconversion professionnelle vers le métier de technicien
                supérieur systèmes et réseaux (TSSR), avec l’envie d’apprendre le développement web
                en parallèle. Le site sert de terrain d’entraînement : il a été créé pour progresser
                par la pratique, et il évolue au fil de cet apprentissage.
              </Typo>
            </div>
            <ul className="mt-4 flex list-none flex-wrap gap-3 p-0">
              {AUTHOR_LINKS.map((link) => {
                const Icon = link.icon;

                return (
                  <li key={link.href}>
                    {/* `noopener` : la page ouverte n'obtient aucune référence vers
                        cet onglet. `noreferrer` : l'adresse du site ne lui est pas
                        transmise. */}
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
                    >
                      <Icon className="size-4" aria-hidden />
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
          <section aria-labelledby="content-origin" className="max-w-3xl">
            <Typo variant="h3" as="h2" id="content-origin">
              Origine du contenu
            </Typo>
            <div className="text-muted mt-3 flex flex-col gap-3 text-sm leading-relaxed">
              <Typo variant="p">
                Les fiches sont rédigées à partir de contenus existants, en premier lieu les
                documentations officielles des technologies présentées. Le texte d’origine est
                reformulé, résumé et adapté au format d’une fiche : ce n’est ni une copie, ni un
                contenu original.
              </Typo>
              <Typo variant="p">
                Chaque fiche cite ses documents d’origine dans un bloc « Sources », placé à la fin
                de la fiche : titre, éditeur, licence, et la mention « Adapté de » quand la fiche
                reprend ce document. Quand elle est renseignée, la date « Vérifié le » indique la
                dernière relecture de la fiche face à sa source.
              </Typo>
              <Typo variant="p">
                Les questions des examens sont produites par un programme de génération de texte, à
                partir du contenu de la fiche. Personne ne les relit avant qu’elles soient posées :
                une question ou sa correction peut être fausse.
              </Typo>
              <Typo variant="p">
                Une erreur dans une fiche ou dans un examen se signale par le lien « Signaler une
                erreur », à la fin de chaque fiche, ou par le{' '}
                <Link to="/contact" className="text-blueberry-light underline underline-offset-2">
                  formulaire de contact
                </Link>
                .
              </Typo>
            </div>
          </section>
        </div>
      </div>

      <ul className="card-grid mb-10 grid list-none gap-4 p-0 [--card-min:22rem]">
        {PARTS.map((part) => {
          const Icon = part.icon;

          return (
            <li key={part.title}>
              <Card>
                <Card.Header>
                  <Card.Title className="flex items-center gap-2">
                    <Icon className="text-blueberry-light size-4" />
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
