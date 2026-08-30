import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function resolveTailwindPlugin() {
  const fromFrontend = createRequire(path.join(rootDir, 'frontend/package.json'));
  try {
    return fromFrontend.resolve('prettier-plugin-tailwindcss');
  } catch {
    return undefined;
  }
}

const tailwindPlugin = resolveTailwindPlugin();

/** @type {import("prettier").Config} */
const config = {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: tailwindPlugin ? [tailwindPlugin] : [],
};

export default config;