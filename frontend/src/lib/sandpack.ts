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

export function resolveSandpackTemplate(template: string): SandpackPredefinedTemplate {
  return TEMPLATE_SET.has(template) ? (template as SandpackPredefinedTemplate) : 'react-ts';
}
