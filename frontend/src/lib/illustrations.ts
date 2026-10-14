import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { apiUrl } from './api';

/**
 * Règles des illustrations d'une fiche (spec 016), écrites une seule fois.
 *
 * Fonctions **pures** : la page publique, l'aperçu et la confirmation de
 * publication décident de la même façon quelle image s'affiche et quels manques
 * signaler. Aucune ne touche au DOM ni au réseau.
 */

/**
 * Une image enregistrée pour une fiche, telle que l'API la renvoie
 * (`EntryImagePublic` du contrat). `width`/`height` sont ceux de la version de
 * lecture : ils réservent la place de l'image avant son arrivée.
 */
export type EntryIllustrationImage = {
  id: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  fullWidth: number;
  fullHeight: number;
};

/**
 * La seule forme d'adresse d'image que le site affiche : `/media/<uuid v4>`,
 * en minuscules, sans rien avant ni après.
 *
 * C'est une liste d'**autorisation** : tout ce qui n'a pas exactement cette
 * forme est refusé (`//hôte`, `/\hôte`, `/media/../`, majuscules, `%2e`,
 * requête, fragment, espaces…), sans chercher à énumérer ce qui est
 * dangereux. Une image refusée n'est pas chargée : une image venue d'un autre
 * site renseignerait ce site sur le lecteur (adresse IP, page lue).
 */
const MEDIA_REFERENCE =
  /^\/media\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

/** Identifiant de l'image si `src` est une référence du site, sinon `null`. */
export function parseMediaReference(src: string | undefined | null): string | null {
  if (typeof src !== 'string') {
    return null;
  }

  return MEDIA_REFERENCE.exec(src)?.[1] ?? null;
}

/** Adresse d'une version d'image, servie par le relais de l'API. */
export function mediaUrl(id: string, variant: 'reading' | 'full'): string {
  return `${apiUrl}/media/${id}/${variant}`;
}

/**
 * Référence Markdown d'une image du site, prête à insérer dans le corps :
 * `![alt](/media/<id>)`.
 *
 * Même règle que `markdownReference` côté serveur : le texte alternatif tient
 * sur une ligne et `\`, `[`, `]` sont échappés, pour qu'une saisie ne puisse ni
 * fermer la référence ni en ouvrir une autre.
 */
export function mediaMarkdown(id: string, alt: string): string {
  const safeAlt = alt.replace(/\s+/g, ' ').replace(/([\\[\]])/g, '\\$1');
  return `![${safeAlt}](/media/${id})`;
}

/** Vrai si le corps cite encore l'image (avertissement avant son retrait). */
export function bodyCitesImage(bodyMdx: string, id: string): boolean {
  return bodyMdx.includes(`/media/${id}`);
}

export const EXTERNAL_IMAGE_GAP = 'Une image vient d’un autre site : elle ne sera pas affichée.';
export const UNKNOWN_IMAGE_GAP = 'Une image est introuvable : elle ne sera pas affichée.';
export const DIAGRAM_DIRECTIVE_GAP =
  'Un schéma contient une directive de configuration : il ne sera pas dessiné.';
export const DIAGRAM_TOO_LONG_GAP = 'Un schéma est trop long : il ne sera pas dessiné.';
export const DIAGRAM_NO_DESCRIPTION_GAP = 'Un schéma n’a pas de description.';
export const DIAGRAM_FAILED_GAP = 'Un schéma n’a pas pu être dessiné.';

/** Langage d'un bloc de code qui est un schéma à dessiner. */
export const DIAGRAM_LANGUAGE = 'mermaid';

/**
 * Taille maximale du texte d'un schéma. Au-delà, il n'est pas dessiné : un
 * schéma démesuré figerait l'onglet le temps du calcul. La même valeur est
 * donnée au moteur (`maxTextSize`, `lib/diagram.ts`).
 */
export const MAX_DIAGRAM_SOURCE_LENGTH = 20_000;

/**
 * Raison de ne **pas** dessiner un schéma, avant même de charger le moteur.
 *
 * - `directive` : le texte change la configuration du moteur, par une
 *   directive `%%{ … }%%` ou un en-tête YAML (`---` … `---`) en tête. Le moteur
 *   protège quelques réglages, mais pas tous : `themeCSS`, par exemple,
 *   injecterait du CSS capable de charger une ressource chez un tiers. Un
 *   schéma de fiche n'a pas besoin de configurer le moteur : tout est refusé.
 * - `too-long` : au-delà de `MAX_DIAGRAM_SOURCE_LENGTH`.
 */
export function diagramSourceRefusal(source: string): 'directive' | 'too-long' | null {
  if (source.length > MAX_DIAGRAM_SOURCE_LENGTH) {
    return 'too-long';
  }

  const firstLine = source.split('\n').find((line) => line.trim() !== '');
  if (source.includes('%%{') || firstLine?.trim() === '---') {
    return 'directive';
  }

  return null;
}

/** Vrai si le schéma porte une description (`accDescr`), lue par les lecteurs d'écran. */
function hasDiagramDescription(source: string): boolean {
  return /^\s*accDescr\s*[:{]/m.test(source);
}

/** Ce qui nous intéresse d'un nœud de l'arbre Markdown (forme structurelle). */
type MarkdownNode = {
  type: string;
  url?: string;
  identifier?: string;
  lang?: string | null;
  value?: string;
  children?: MarkdownNode[];
};

/** Parcourt l'arbre en profondeur. Un bloc de code n'a pas d'enfants : son texte n'est jamais vu comme une image. */
function walk(node: MarkdownNode, visit: (node: MarkdownNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) {
    walk(child, visit);
  }
}

/**
 * Manques d'illustration du corps d'une fiche, au plus une fois chacun.
 *
 * Le corps est lu en arbre Markdown, comme `react-markdown` le lit pour
 * l'afficher : une image dans un bloc de code reste du texte, une image dans
 * un lien ou écrite par référence (`![a][ref]`) est bien vue comme une image.
 *
 * `imageIds` : les images enregistrées pour **cette** fiche. Une référence du
 * site qui n'y figure pas (image retirée, ou empruntée à une autre fiche) est
 * introuvable.
 *
 * Schémas : directive refusée, texte trop long, description absente. Un schéma
 * à la syntaxe fausse ne se détecte qu'en le dessinant : l'aperçu le signale
 * à part (`DIAGRAM_FAILED_GAP`).
 */
export function illustrationGaps(bodyMdx: string, imageIds: readonly string[]): string[] {
  if (bodyMdx.trim() === '') {
    return [];
  }

  const tree = fromMarkdown(bodyMdx, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }) as MarkdownNode;

  // Une image par référence pointe vers une définition (`[ref]: adresse`).
  const definitions = new Map<string, string>();
  walk(tree, (node) => {
    if (node.type === 'definition' && node.identifier !== undefined && node.url !== undefined) {
      definitions.set(node.identifier, node.url);
    }
  });

  const known = new Set(imageIds);
  let external = false;
  let unknown = false;
  let directive = false;
  let tooLong = false;
  let undescribed = false;

  walk(tree, (node) => {
    if (node.type !== 'code' || node.lang !== DIAGRAM_LANGUAGE) {
      return;
    }

    const source = node.value ?? '';
    const refusal = diagramSourceRefusal(source);
    if (refusal === 'directive') directive = true;
    if (refusal === 'too-long') tooLong = true;
    if (refusal === null && !hasDiagramDescription(source)) undescribed = true;
  });

  walk(tree, (node) => {
    let url: string | undefined;
    if (node.type === 'image') {
      url = node.url;
    } else if (node.type === 'imageReference' && node.identifier !== undefined) {
      url = definitions.get(node.identifier);
    } else {
      return;
    }

    // Référence sans définition : `react-markdown` l'affiche comme du texte,
    // ce n'est pas une image.
    if (url === undefined) {
      return;
    }

    const id = parseMediaReference(url);
    if (id === null) {
      external = true;
    } else if (!known.has(id)) {
      unknown = true;
    }
  });

  const gaps: string[] = [];
  if (external) gaps.push(EXTERNAL_IMAGE_GAP);
  if (unknown) gaps.push(UNKNOWN_IMAGE_GAP);
  if (directive) gaps.push(DIAGRAM_DIRECTIVE_GAP);
  if (tooLong) gaps.push(DIAGRAM_TOO_LONG_GAP);
  if (undescribed) gaps.push(DIAGRAM_NO_DESCRIPTION_GAP);
  return gaps;
}
