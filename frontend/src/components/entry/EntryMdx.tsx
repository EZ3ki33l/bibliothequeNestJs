import {
  Children,
  cloneElement,
  isValidElement,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { MarkdownHooks, type Components, type HooksOptions } from 'react-markdown';
import { Table } from '@heroui/react';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode, { type Options as RehypePrettyCodeOptions } from 'rehype-pretty-code';
import rehypeUnwrapImages from 'rehype-unwrap-images';
import { parseMediaReference, type EntryIllustrationImage } from '../../lib/illustrations';
import { Typo } from '../ui/Typo';
import { BlockedImage } from './BlockedImage';
import { EntryImage } from './EntryImage';
import { MermaidDiagram } from './MermaidDiagram';
import { DIAGRAM_ELEMENT, remarkDiagramBlocks } from './remarkDiagramBlocks';

const prettyCodeOptions: RehypePrettyCodeOptions = {
  theme: 'github-dark',
  // Le fond des blocs de code vient de `.entry-mdx` (index.css), aux couleurs de
  // la charte : celui du thème de coloration n'est pas repris.
  keepBackground: false,
  defaultLang: { block: 'ts', inline: 'plaintext' },
};

// Références stables : MarkdownHooks relance son effet dès que ces tableaux changent d'identité.
// `remarkDiagramBlocks` sort les blocs `mermaid` du circuit de coloration du code (spec 016).
const REMARK_PLUGINS: HooksOptions['remarkPlugins'] = [remarkGfm, remarkDiagramBlocks];
// `rehypeUnwrapImages` sort une image seule de son paragraphe (affichage en bloc, spec 016).
const REHYPE_PLUGINS: HooksOptions['rehypePlugins'] = [
  rehypeUnwrapImages,
  [rehypePrettyCode, prettyCodeOptions],
];

/** Tableau vide stable : sans images, `components` garde la même identité d'un rendu à l'autre. */
const NO_IMAGES: readonly EntryIllustrationImage[] = [];

type EntryMdxProps = {
  source: string;
  /**
   * Images enregistrées pour **cette** fiche (spec 016). Seules elles
   * s'affichent ; toute autre image du corps est remplacée par un cadre.
   */
  images?: readonly EntryIllustrationImage[];
  /** Appelé pour chaque schéma qui n'a pas pu être dessiné (l'aperçu en fait un manque). */
  onDiagramError?: () => void;
};

export function EntryMdx({ source, images = NO_IMAGES, onDiagramError }: EntryMdxProps) {
  /**
   * Rendu des images du corps : **liste d'autorisation**.
   *
   * Par défaut, `react-markdown` laisse passer une image `https://…` : le
   * navigateur irait la chercher chez un tiers, qui apprendrait l'adresse IP du
   * lecteur et la fiche lue. Dans un brouillon d'un `ADMIN`, ce serait un pixel
   * espion dans la session du `SUPER_ADMIN` qui relit. Ici, une image ne
   * s'affiche que si son adresse est celle d'une image enregistrée pour la
   * fiche (`/media/<uuid>`) ; tout le reste devient `BlockedImage`, sans
   * requête.
   *
   * `useMemo` : un nouvel objet `components` à chaque rendu ferait relancer le
   * rendu Markdown.
   */
  const components = useMemo<Components>(() => {
    const byId = new Map(images.map((image) => [image.id, image]));

    // Élément produit par `remarkDiagramBlocks` : son seul enfant est le texte
    // du schéma. Ce n'est pas une balise HTML connue, d'où l'ajout par clé.
    const diagram = {
      [DIAGRAM_ELEMENT]: ({ children }: { children?: unknown }) => (
        <MermaidDiagram
          source={typeof children === 'string' ? children : ''}
          onError={onDiagramError}
        />
      ),
    } as Components;

    return {
      ...diagram,
      table: ({ children }) => (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Tableau de la fiche">{children}</Table.Content>
          </Table.ScrollContainer>
        </Table>
      ),
      // HeroUI attend les colonnes directement dans l'en-tête, sans `<tr>` :
      // on déplie la ligne que Markdown y met. Seule la première colonne nomme
      // la ligne (lecteur d'écran) : elle porte l'élément comparé.
      thead: ({ children }) => (
        <Table.Header>
          {Children.toArray(children)
            .flatMap((row) =>
              isValidElement<{ children?: ReactNode }>(row)
                ? Children.toArray(row.props.children)
                : [],
            )
            .map((cell, index) =>
              isValidElement<{ isRowHeader?: boolean }>(cell)
                ? cloneElement(cell, { isRowHeader: index === 0 })
                : cell,
            )}
        </Table.Header>
      ),
      th: ({ children, style, isRowHeader }: ComponentProps<'th'> & { isRowHeader?: boolean }) => (
        <Table.Column isRowHeader={isRowHeader} style={style}>
          {children}
        </Table.Column>
      ),
      tbody: ({ children }) => <Table.Body>{children}</Table.Body>,
      tr: ({ children }) => <Table.Row>{children}</Table.Row>,
      td: ({ children, style }) => <Table.Cell style={style}>{children}</Table.Cell>,
      img({ src, alt }) {
        const id = parseMediaReference(typeof src === 'string' ? src : undefined);
        const image = id === null ? undefined : byId.get(id);

        if (image === undefined) {
          return <BlockedImage alt={alt} />;
        }

        return <EntryImage image={image} />;
      },
    };
  }, [images, onDiagramError]);

  return (
    <div className="entry-mdx">
      <MarkdownHooks
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
        fallback={
          <Typo variant="small" as="p">
            Chargement du contenu…
          </Typo>
        }
      >
        {source}
      </MarkdownHooks>
    </div>
  );
}
