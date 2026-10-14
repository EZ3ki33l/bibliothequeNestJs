import { DIAGRAM_LANGUAGE } from '../../lib/illustrations';

/** Forme minimale d'un nœud de l'arbre Markdown (sans dépendre des types `mdast`). */
type MarkdownNode = {
  type: string;
  lang?: string | null;
  value?: string;
  data?: Record<string, unknown>;
  children?: MarkdownNode[];
};

/** Nom de l'élément produit pour un schéma ; `EntryMdx` le rend avec `MermaidDiagram`. */
export const DIAGRAM_ELEMENT = 'entry-diagram';

/**
 * Plugin remark : chaque bloc de code de langage `mermaid` devient un élément
 * `entry-diagram` qui porte le texte brut du schéma.
 *
 * Il doit passer **avant** la coloration du code (`rehype-pretty-code`), qui
 * colorerait sinon le schéma comme du code. Un plugin remark agit sur l'arbre
 * Markdown, avant toute étape rehype : l'ordre est donc garanti.
 *
 * Le texte reste un nœud texte : rien n'est interprété comme du HTML.
 */
export function remarkDiagramBlocks() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (node.type === 'code' && node.lang === DIAGRAM_LANGUAGE) {
        const source = node.value ?? '';
        node.type = 'entryDiagram';
        node.data = {
          hName: DIAGRAM_ELEMENT,
          hProperties: {},
          hChildren: [{ type: 'text', value: source }],
        };
        return;
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
