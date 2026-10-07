import type { SandpackPredefinedTemplate, SandpackTheme } from '@codesandbox/sandpack-react';

/**
 * Thème de l'atelier de code, aux couleurs de la charte.
 *
 * Sandpack attend des valeurs littérales (il génère ses propres styles) : les
 * teintes de `index.css` sont donc recopiées ici, et nulle part ailleurs.
 * L'éditeur est sur Black Sea sombre, comme les blocs de code d'une fiche ;
 * l'accent est le Blueberry.
 */
export const SANDPACK_THEME: SandpackTheme = {
  colors: {
    surface1: '#0f1216',
    surface2: '#1e242b',
    surface3: '#3d4551',
    clickable: '#9ca3af',
    base: '#d1d5db',
    disabled: '#6b7280',
    hover: '#f5f7fa',
    accent: '#8f9af0',
    error: '#f27269',
    errorSurface: '#3a1512',
  },
  syntax: {
    plain: '#d1d5db',
    comment: { color: '#7d8795', fontStyle: 'italic' },
    keyword: '#f27269',
    tag: '#8f9af0',
    punctuation: '#9ca3af',
    definition: '#38bdf8',
    property: '#8f9af0',
    static: '#fbbf24',
    string: '#34d399',
  },
  font: {
    body: "'Inter Variable', system-ui, sans-serif",
    mono: "'Geist Mono Variable', ui-monospace, monospace",
    size: '0.8125rem',
    lineHeight: '1.25rem',
  },
};

export const SANDPACK_TEMPLATES = [
  'static',
  'angular',
  'react',
  'react-ts',
  'solid',
  'svelte',
  'vanilla',
  'vanilla-ts',
  'vue',
  'vue-ts',
  'node',
  'nextjs',
  'vite',
  'vite-react',
  'vite-react-ts',
] as const;

const TEMPLATE_SET = new Set<string>(SANDPACK_TEMPLATES);

/**
 * Valide le modèle Sandpack enregistré en base.
 *
 * `template` est une simple colonne texte : elle peut contenir une valeur
 * obsolète (modèle renommé par Sandpack) ou invalide. Plutôt que de laisser
 * l'éditeur planter, on retombe sur `react-ts`.
 *
 * Le `as` n'est pas un contournement du typage : le `Set` est construit depuis
 * `SANDPACK_TEMPLATES`, donc à l'intérieur du `if`, la chaîne est forcément
 * l'une de ces valeurs — TypeScript ne sait juste pas le déduire d'un `Set`.
 */
export function resolveSandpackTemplate(template: string): SandpackPredefinedTemplate {
  return TEMPLATE_SET.has(template) ? (template as SandpackPredefinedTemplate) : 'react-ts';
}
