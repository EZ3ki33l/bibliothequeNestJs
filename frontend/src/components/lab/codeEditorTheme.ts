import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { SANDPACK_THEME } from '../../lib/sandpack';

/**
 * Thème de l'éditeur de l'atelier Python, construit sur les couleurs de
 * l'atelier web (`SANDPACK_THEME`) : les deux ateliers se ressemblent, et les
 * teintes de la charte ne sont recopiées qu'à un seul endroit.
 */
const { colors, syntax, font } = SANDPACK_THEME;
const styleOf = (value: string | { color?: string; fontStyle?: string } | undefined) =>
  typeof value === 'string' ? { color: value } : (value ?? {});

const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: colors.surface1,
      color: colors.base,
      fontSize: font.size,
      // En `rem`, comme l'atelier web : il grandit avec l'interface.
      height: '20rem',
    },
    '.cm-scroller': { fontFamily: font.mono, lineHeight: font.lineHeight },
    '.cm-content': { caretColor: colors.accent },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: colors.accent },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: colors.surface3,
    },
    '.cm-gutters': {
      backgroundColor: colors.surface1,
      color: colors.disabled,
      border: 'none',
    },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: colors.surface2 },
    '.cm-matchingBracket': { outline: `1px solid ${colors.clickable}` },
  },
  { dark: true },
);

const highlightStyle = HighlightStyle.define([
  { tag: tags.comment, ...styleOf(syntax.comment) },
  { tag: [tags.keyword, tags.operatorKeyword, tags.controlKeyword], ...styleOf(syntax.keyword) },
  { tag: [tags.string, tags.special(tags.string)], ...styleOf(syntax.string) },
  { tag: [tags.number, tags.bool, tags.null], ...styleOf(syntax.static) },
  {
    tag: [tags.function(tags.variableName), tags.definition(tags.variableName)],
    ...styleOf(syntax.definition),
  },
  { tag: [tags.className, tags.propertyName], ...styleOf(syntax.property) },
  { tag: [tags.punctuation, tags.bracket, tags.operator], ...styleOf(syntax.punctuation) },
]);

export const codeEditorTheme = [editorTheme, syntaxHighlighting(highlightStyle)];
