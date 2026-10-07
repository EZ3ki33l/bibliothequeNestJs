import { MarkdownHooks, type HooksOptions } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode, { type Options as RehypePrettyCodeOptions } from 'rehype-pretty-code';
import { Typo } from '../ui/Typo';

const prettyCodeOptions: RehypePrettyCodeOptions = {
  theme: 'github-dark',
  // Le fond des blocs de code vient de `.entry-mdx` (index.css), aux couleurs de
  // la charte : celui du thème de coloration n'est pas repris.
  keepBackground: false,
  defaultLang: { block: 'ts', inline: 'plaintext' },
};

// Références stables : MarkdownHooks relance son effet dès que ces tableaux changent d'identité.
const REMARK_PLUGINS: HooksOptions['remarkPlugins'] = [remarkGfm];
const REHYPE_PLUGINS: HooksOptions['rehypePlugins'] = [[rehypePrettyCode, prettyCodeOptions]];

type EntryMdxProps = { source: string };

export function EntryMdx({ source }: EntryMdxProps) {
  return (
    <div className="entry-mdx">
      <MarkdownHooks
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
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
