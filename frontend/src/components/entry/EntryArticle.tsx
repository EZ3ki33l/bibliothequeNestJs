import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { playgroundStatus } from '../../lib/entryChecks';
import { verificationLabel, type EntrySource } from '../../lib/entrySources';
import type { Difficulty, EntryKind, SandpackFiles } from '../../lib/stacks';
import { Playground } from '../lab/Playground';
import { EmptyMessage } from '../ui/EmptyMessage';
import { EntryMeta } from '../ui/EntryMeta';
import { EntryMdx } from './EntryMdx';
import { EntrySources } from './EntrySources';
import { Typo } from '../ui/Typo';

/** Ce qui décrit la fiche pour tout le monde, et les emplacements du lecteur. */
type EntryHeaderProps = {
  title: string;
  /** `null` ou chaîne vide : pas de paragraphe de résumé. */
  summary: string | null;
  kind: EntryKind;
  difficulty: Difficulty;
  tags: string[];
  /** Étiquettes cliquables vers `/recherche?tag=`. Défaut : `true`. */
  linkTags?: boolean;
  /** Action du lecteur rendue dans l'en-tête : le favori. */
  headerActions?: ReactNode;
  /** Contenu placé avant l'en-tête (lien de retour, fil d'Ariane). */
  lead?: ReactNode;
  /**
   * Contenu placé après le corps et les sources : examen, note, étapes du
   * parcours, signalement.
   */
  footer?: ReactNode;
};

/** Le contenu de la fiche : corps, playground, sources, vérification. */
type EntryContentProps = {
  /** Chaîne vide : état « pas encore de contenu ». */
  bodyMdx: string;
  template: string;
  /** `undefined` : aucun fichier. */
  files: SandpackFiles | undefined;
  dependencies: SandpackFiles | undefined;
  /** Liste vide : aucun bloc « Sources ». */
  sources: EntrySource[];
  /** `null` : aucune mention de vérification, même si une version existe. */
  verifiedOn: string | null;
  verifiedVersion: string;
};

/**
 * Deux formes, que le compilateur tient séparées :
 * - la fiche **lue** : l'en-tête et tout le contenu ;
 * - la fiche **illisible** pour ce lecteur : l'en-tête et `locked`, sans aucune
 *   prop de contenu. Le serveur ne l'a pas transmis, il n'y a rien à passer.
 */
type EntryArticleProps = EntryHeaderProps &
  (
    | (EntryContentProps & { locked?: undefined })
    | {
        /**
         * Rendu **à la place** du corps, du playground et des sources, entre
         * l'en-tête et `footer` : la zone floutée et son message.
         */
        locked: NonNullable<ReactNode>;
      }
  );

/**
 * Rendu d'une fiche : en-tête, corps, playground et sources.
 *
 * Composant de **présentation** : il reçoit des valeurs et les affiche. Il ne
 * charge rien, ne connaît pas la session et ne déclenche aucun effet de bord.
 * C'est ce qui permet à la page publique et à l'aperçu de l'administration de
 * partager exactement le même rendu, l'une à partir de la réponse de l'API,
 * l'autre à partir d'une saisie non enregistrée.
 *
 * Le partage suit une règle : ce qui **décrit la fiche** est rendu ici (dont
 * les sources et la mention « Vérifié le »), donc visible dans l'aperçu sans
 * travail séparé. Ce qui dépend du **lecteur** (favori, examen, note) ou de sa
 * navigation (fil d'Ariane, étapes d'un parcours, signalement) arrive par
 * `lead`, `headerActions` et `footer` : le composant place ces emplacements
 * sans savoir ce qu'ils contiennent, et l'aperçu ne les remplit pas.
 *
 * `locked` suit la même règle : c'est le lecteur, pas la fiche, qui fait
 * qu'elle est illisible. La page publique le fournit pour une fiche réservée
 * que ce lecteur ne peut pas lire ; il remplace alors tout le contenu. Le
 * composant ne décide pas de cet accès, il affiche ce qu'on lui donne.
 * **L'aperçu de l'administration ne fournit jamais `locked`** : ses lectures
 * dépendent des rôles, pas de la vérification de l'adresse.
 *
 * Le contenu suit directement l'en-tête : rien de ce qui se fait **après** la
 * lecture (examen, note) ne s'intercale entre le titre et la leçon.
 *
 * La balise `<article>` et ses classes sont rendues ici : largeur et
 * espacements font partie du rendu partagé, aucun appelant ne les recopie.
 *
 * Deux blocs dans l'article : le contenu (`lead`, en-tête, corps), puis
 * `footer`. Sur un écran large, `.rail-layout` (`index.css`) place le second à
 * droite du premier ; l'ordre dans la page, lui, ne change jamais.
 */
export function EntryArticle(props: EntryArticleProps) {
  const {
    title,
    summary,
    kind,
    difficulty,
    tags,
    linkTags = true,
    headerActions,
    lead,
    footer,
  } = props;
  // La mention « Vérifié le » fait partie du contenu : absente d'une fiche
  // illisible, dont le serveur ne transmet que l'en-tête.
  const verification =
    props.locked === undefined ? verificationLabel(props.verifiedOn, props.verifiedVersion) : null;

  return (
    <article className="rail-layout mx-auto w-full max-w-4xl 2xl:has-[>.rail:not(:empty)]:max-w-[76rem]">
      <div className="flex min-w-0 flex-col gap-8">
        {lead}
        <header className="border-border border-b pb-6">
          <Typo variant="h1">{title}</Typo>
          {summary ? (
            <Typo variant="lead" className="mt-4 max-w-[60ch]">
              {summary}
            </Typo>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <EntryMeta kind={kind} difficulty={difficulty} />
          </div>
          {verification ? (
            <Typo variant="caption" className="mt-3">
              {verification}
            </Typo>
          ) : null}
          {tags.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {tags.map((tag) => (
                <li key={tag}>
                  {linkTags ? (
                    /* Suivre un tag ouvre la recherche déjà filtrée (US3 / FR-006).
                     `encodeURIComponent` protège un tag qui contiendrait un
                     espace ou un caractère spécial dans l'URL. */
                    <Link
                      to={`/recherche?tag=${encodeURIComponent(tag)}`}
                      className="text-blueberry-light text-xs underline-offset-2 hover:underline"
                    >
                      #{tag}
                    </Link>
                  ) : (
                    // Même apparence, sans l'effet de survol : rien ne suggère un clic.
                    <span className="text-blueberry-light text-xs">#{tag}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {headerActions}
        </header>

        {props.locked === undefined ? (
          <EntryContent
            bodyMdx={props.bodyMdx}
            kind={kind}
            template={props.template}
            files={props.files}
            dependencies={props.dependencies}
            sources={props.sources}
          />
        ) : (
          props.locked
        )}
      </div>

      {/* Ce qui suit la lecture. Sous la fiche sur un écran ordinaire ; à sa
          droite, et toujours visible, sur un écran large (`.rail-layout`).
          Sans `footer` (aperçu de l'administration), le bloc reste vide et la
          fiche garde une seule colonne. */}
      <div className="rail 2xl:bg-surface mt-8 flex min-w-0 flex-col gap-8 empty:hidden 2xl:mt-0 2xl:gap-6 2xl:rounded-2xl 2xl:p-5">
        {footer}
      </div>
    </article>
  );
}

/** Corps, playground et sources d'une fiche lue. */
function EntryContent({
  bodyMdx,
  kind,
  template,
  files,
  dependencies,
  sources,
}: Omit<EntryContentProps, 'verifiedOn' | 'verifiedVersion'> & { kind: EntryKind }) {
  return (
    <>
      {bodyMdx ? (
        <EntryMdx source={bodyMdx} />
      ) : (
        <EmptyMessage>Cette fiche n’a pas encore de contenu.</EmptyMessage>
      )}

      {/* La décision appartient à `playgroundStatus` (règle écrite une seule
          fois). Le test `files !== undefined` n'ajoute aucune règle : il sert au
          compilateur, qui ne peut pas déduire d'un statut que `files` existe. */}
      {files !== undefined && playgroundStatus(kind, files) === 'shown' ? (
        <Playground files={files} template={template} dependencies={dependencies} />
      ) : null}

      <EntrySources sources={sources} />
    </>
  );
}
