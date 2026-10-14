import type { Mermaid, MermaidConfig } from 'mermaid';
import { DIAGRAM_THEME_VARIABLES } from './diagramTheme';
import { diagramSourceRefusal, MAX_DIAGRAM_SOURCE_LENGTH } from './illustrations';

/**
 * Dessin des schémas d'une fiche (spec 016, story 2).
 *
 * Le texte d'un schéma est écrit par un `ADMIN` et dessiné dans la session du
 * `SUPER_ADMIN` qui relit le brouillon : c'est un contenu **non fiable**. Le
 * dessin a lieu dans la page (pas dans une iframe), donc six verrous :
 *
 * 1. le moteur n'est chargé qu'à la demande, depuis le site (`import()`) ;
 * 2. `securityLevel: 'strict'` : le texte des nœuds est encodé, les actions au
 *    clic sont désactivées ;
 * 3. `htmlLabels: false` : des étiquettes en texte SVG, pas en HTML ;
 * 4. toute la configuration est verrouillée (`secure`) et les directives sont
 *    refusées avant le dessin (`diagramSourceRefusal`) ;
 * 5. le SVG produit est assaini par DOMPurify avant d'entrer dans la page ;
 * 6. la CSP de la SPA (nginx) refuse toute image, police ou feuille de style
 *    venue d'ailleurs.
 *
 * **Version figée** (`mermaid` 12.2.0 dans `package.json`) : à chaque mise à
 * jour, relire la liste des clés de `MermaidConfig` et compléter `SECURE_KEYS`.
 */

/**
 * Toutes les clés de premier niveau de `MermaidConfig` (Mermaid 12.2.0) : une
 * clé « sûre » ne peut être changée que par `initialize`, jamais par le texte
 * d'un schéma. La liste par défaut du moteur oublie `themeCSS` (du CSS
 * arbitraire) et `dompurifyConfig` (qui relâcherait l'assainissement).
 */
const SECURE_KEYS = [
  'theme',
  'themeVariables',
  'themeCSS',
  'look',
  'handDrawnSeed',
  'layout',
  'maxTextSize',
  'maxEdges',
  'elk',
  'darkMode',
  'htmlLabels',
  'fontFamily',
  'altFontFamily',
  'logLevel',
  'securityLevel',
  'startOnLoad',
  'arrowMarkerAbsolute',
  'secure',
  'legacyMathML',
  'forceLegacyMathML',
  'deterministicIds',
  'deterministicIDSeed',
  'flowchart',
  'swimlane',
  'agentflow',
  'sequence',
  'gantt',
  'journey',
  'timeline',
  'class',
  'state',
  'er',
  'pie',
  'quadrantChart',
  'xyChart',
  'requirement',
  'architecture',
  'mindmap',
  'ishikawa',
  'kanban',
  'gitGraph',
  'sankey',
  'packet',
  'block',
  'eventmodeling',
  'treeView',
  'radar',
  'usecase',
  'venn',
  'cynefin',
  'railroad',
  'dompurifyConfig',
  'wrap',
  'fontSize',
  'markdownAutoWrap',
  'suppressErrorRendering',
];

const CONFIG: MermaidConfig = {
  startOnLoad: false,
  securityLevel: 'strict',
  htmlLabels: false,
  maxTextSize: MAX_DIAGRAM_SOURCE_LENGTH,
  maxEdges: 200,
  theme: 'base',
  themeVariables: { ...DIAGRAM_THEME_VARIABLES },
  fontFamily: DIAGRAM_THEME_VARIABLES.fontFamily,
  // Un échec ne doit pas laisser de « bombe » d'erreur dessinée dans la page.
  suppressErrorRendering: true,
  deterministicIds: true,
  logLevel: 'fatal',
  secure: SECURE_KEYS,
};

export type DiagramResult = { ok: true; svg: string } | { ok: false };

let enginePromise: Promise<Mermaid> | null = null;

/** Charge et initialise le moteur une seule fois ; un échec permet de réessayer plus tard. */
function loadEngine(): Promise<Mermaid> {
  enginePromise ??= import('mermaid')
    .then(({ default: mermaid }) => {
      mermaid.initialize(CONFIG);
      return mermaid;
    })
    .catch((error: unknown) => {
      enginePromise = null;
      throw error;
    });

  return enginePromise;
}

let purifierPromise: Promise<(svg: string) => string> | null = null;

/**
 * Assainisseur du SVG produit : une instance DOMPurify **propre** à ce module
 * (ses règles ne s'appliquent à rien d'autre).
 *
 * - profil SVG uniquement (pas de HTML) ;
 * - interdits : `foreignObject` (HTML dans le SVG), `a`, `image` (ressource
 *   chargée), `script` ;
 * - un `href` ou `xlink:href` qui ne vise pas un élément du même SVG (`#…`)
 *   est retiré.
 */
function loadPurifier(): Promise<(svg: string) => string> {
  purifierPromise ??= import('dompurify').then(({ default: createDOMPurify }) => {
    const purifier = createDOMPurify(window);

    purifier.addHook('uponSanitizeAttribute', (_node, data) => {
      if (
        (data.attrName === 'href' || data.attrName === 'xlink:href') &&
        !data.attrValue.startsWith('#')
      ) {
        data.keepAttr = false;
      }
    });

    return (svg: string) =>
      purifier.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['style'],
        FORBID_TAGS: ['foreignObject', 'a', 'image', 'script'],
      });
  });

  return purifierPromise;
}

let renderCount = 0;

/**
 * Dessine un schéma. Ne lève jamais : tout échec (refus, syntaxe, moteur
 * introuvable) donne `{ ok: false }`, que le composant affiche comme un
 * schéma illisible.
 */
export async function renderDiagram(source: string): Promise<DiagramResult> {
  if (diagramSourceRefusal(source) !== null) {
    return { ok: false };
  }

  try {
    const [mermaid, purify] = await Promise.all([loadEngine(), loadPurifier()]);
    renderCount += 1;
    const { svg } = await mermaid.render(`entry-diagram-${renderCount}`, source);
    const clean = purify(svg);

    return clean.trim() === '' ? { ok: false } : { ok: true, svg: clean };
  } catch {
    return { ok: false };
  }
}
