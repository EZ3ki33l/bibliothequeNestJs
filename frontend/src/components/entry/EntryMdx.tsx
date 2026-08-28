import { MarkdownHooks, type HooksOptions } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode, { type Options as RehypePrettyCodeOptions } from 'rehype-pretty-code';

const prettyCodeOptions: RehypePrettyCodeOptions = {
  theme: 'github-dark',
  keepBackground: true,
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
        fallback={<p className="text-muted text-sm">Chargement du contenu…</p>}
      >
        {source}
      </MarkdownHooks>
    </div>
  );
}
