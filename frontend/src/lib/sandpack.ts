import type { SandpackPredefinedTemplate } from '@codesandbox/sandpack-react';

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
