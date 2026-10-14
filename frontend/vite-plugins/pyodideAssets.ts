import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

// Spec 017 : le moteur Python est servi par le site, jamais par un CDN. Ce
// plugin prend les cinq fichiers utiles dans node_modules/pyodide (la version
// servie est donc toujours celle installée), les copie dans
// dist/pyodide/<version>/ au build et les sert au même chemin en
// développement. Le reste du paquet (consoles HTML, cartes de source) ne part
// pas en production.
const ENGINE_FILES = [
  'pyodide.js',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
] as const;

const CONTENT_TYPES: Record<(typeof ENGINE_FILES)[number], string> = {
  'pyodide.js': 'text/javascript',
  'pyodide.asm.mjs': 'text/javascript',
  'pyodide.asm.wasm': 'application/wasm',
  'python_stdlib.zip': 'application/zip',
  'pyodide-lock.json': 'application/json',
};

// Même CSP que nginx.conf (location /python-runner/) : le document de
// l'iframe d'origine opaque ne se connecte à rien, le moteur lui est donné par
// la page. Contrat : specs/017-python-runtime/contracts/http.md.
const RUNNER_CSP =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src blob:; connect-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

export function pyodideAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const packageDir = dirname(require.resolve('pyodide/package.json'));
  const { version } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
    version: string;
  };
  const base = `/pyodide/${version}/`;
  // Taille avant compression : la progression compte les octets décompressés.
  const size = ENGINE_FILES.reduce(
    (total, name) => total + statSync(join(packageDir, name)).size,
    0,
  );

  return {
    name: 'pyodide-assets',
    config: () => ({
      define: {
        'import.meta.env.VITE_PYODIDE_VERSION': JSON.stringify(version),
        'import.meta.env.VITE_PYODIDE_SIZE': JSON.stringify(size),
      },
    }),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (path.startsWith('/python-runner/')) {
          // Les fichiers eux-mêmes sont servis par Vite depuis public/.
          res.setHeader('Content-Security-Policy', RUNNER_CSP);
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          next();
          return;
        }
        const name = path.startsWith(base) ? path.slice(base.length) : '';
        if (!(ENGINE_FILES as readonly string[]).includes(name)) {
          next();
          return;
        }
        res.setHeader('Content-Type', CONTENT_TYPES[name as (typeof ENGINE_FILES)[number]]);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.end(readFileSync(join(packageDir, name)));
      });
    },
    generateBundle() {
      for (const name of ENGINE_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: `pyodide/${version}/${name}`,
          source: readFileSync(join(packageDir, name)),
        });
      }
    },
  };
}
