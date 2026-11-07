import { createHash } from 'node:crypto';
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, ResolvedConfig } from 'vite';

// Spec 020 : les fichiers de la synthèse vocale sont servis par le site, jamais
// par un CDN (contrat : specs/020-entry-audio/contracts/assets-http.md). Comme
// `pyodideAssets`, ce plugin les prend dans node_modules (la version servie est
// donc toujours celle installée), les copie dans dist/piper/ au build et les
// sert aux mêmes adresses en développement.
//
//   /piper/<v>/engine/       runtime ONNX (onnxruntime-web)
//   /piper/<v>/phonemizer/   phonémiseur GPL-3 isolé (frontend/phonemizer/ + paquet piper-wasm)
//   /piper/voices/<id>/      modèle de voix (.voices/, téléchargé par `pnpm voices:fetch`)

type LockFile = { name: string; path: string; size: number; sha256: string };
type LockModel = {
  id: string;
  speakers: Record<string, number>;
  license: string;
  files: LockFile[];
};
type Lock = { models: LockModel[] };

type Asset = { url: string; source: string; size: number; kind: 'engine' | 'phonemizer' | 'voice' };

const ENGINE_FILES = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'] as const;
const PHONEMIZER_PACKAGE_FILES = [
  'piper_phonemize.js',
  'piper_phonemize.wasm',
  'piper_phonemize.data',
] as const;
const PHONEMIZER_OWN_FILES = ['worker.js', 'LICENSE', 'SOURCE.md'] as const;

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.onnx': 'application/octet-stream',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
  LICENSE: 'text/plain; charset=utf-8',
};

function contentType(name: string): string {
  const dot = name.lastIndexOf('.');
  return CONTENT_TYPES[dot === -1 ? name : name.slice(dot)] ?? 'application/octet-stream';
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function piperAssets(): Plugin {
  const require = createRequire(import.meta.url);
  // frontend/ : le plugin vit dans frontend/vite-plugins/, pas dans le dossier de lancement.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');

  const ortDist = dirname(require.resolve('onnxruntime-web'));
  const ortVersion = (
    JSON.parse(readFileSync(join(ortDist, '..', 'package.json'), 'utf8')) as { version: string }
  ).version;
  const piperWasmDir = dirname(require.resolve('@diffusionstudio/piper-wasm/package.json'));
  const piperWasmVersion = (
    JSON.parse(readFileSync(join(piperWasmDir, 'package.json'), 'utf8')) as { version: string }
  ).version;
  const phonemizerOwnDir = join(root, 'phonemizer');
  const voicesDir = join(root, '.voices');
  const lock = JSON.parse(readFileSync(join(root, 'voices.lock.json'), 'utf8')) as Lock;

  // Le chemin porte la version : une mise à jour change l'adresse, les caches suivent.
  // Les fichiers de frontend/phonemizer/ sont à nous et mis en cache un an : leur
  // empreinte entre dans la version, sinon corriger worker.js laisserait l'ancien
  // dans les navigateurs.
  const ownHash = createHash('sha256');
  for (const name of PHONEMIZER_OWN_FILES)
    ownHash.update(readFileSync(join(phonemizerOwnDir, name)));
  const version = `ort-${ortVersion}_phonemize-${piperWasmVersion}-${ownHash.digest('hex').slice(0, 8)}`;
  const base = `/piper/${version}/`;

  const assets: Asset[] = [
    ...ENGINE_FILES.map((name): Asset => {
      const source = join(ortDist, name);
      return { url: `${base}engine/${name}`, source, size: statSync(source).size, kind: 'engine' };
    }),
    ...PHONEMIZER_PACKAGE_FILES.map((name): Asset => {
      const source = join(piperWasmDir, 'build', name);
      return {
        url: `${base}phonemizer/${name}`,
        source,
        size: statSync(source).size,
        kind: 'phonemizer',
      };
    }),
    ...PHONEMIZER_OWN_FILES.map((name): Asset => {
      const source = join(phonemizerOwnDir, name);
      return {
        url: `${base}phonemizer/${name}`,
        source,
        size: statSync(source).size,
        kind: 'phonemizer',
      };
    }),
    ...lock.models.flatMap((model) =>
      model.files.map((file): Asset => ({
        url: `/piper/voices/${model.id}/${file.name}`,
        source: join(voicesDir, model.id, file.name),
        size: file.size,
        kind: 'voice',
      })),
    ),
  ];

  // Taille déclarée (avant compression) : sert à annoncer le poids et la progression.
  const manifest = {
    version,
    base,
    engine: assets.filter((a) => a.kind === 'engine').map((a) => ({ url: a.url, size: a.size })),
    phonemizer: assets
      .filter((a) => a.kind === 'phonemizer' && /piper_phonemize\.|worker\.js$/.test(a.url))
      .map((a) => ({ url: a.url, size: a.size })),
    voices: Object.fromEntries(
      lock.models.map((model) => [
        model.id,
        {
          speakers: model.speakers,
          files: model.files.map((file) => ({
            url: `/piper/voices/${model.id}/${file.name}`,
            size: file.size,
          })),
        },
      ]),
    ),
  };

  // Vérifie que le modèle est là et conforme AVANT de construire : un site sans
  // voix, ou avec un fichier remplacé, ne doit pas sortir en silence.
  function assertVoicesReady(): void {
    for (const model of lock.models) {
      for (const file of model.files) {
        const path = join(voicesDir, model.id, file.name);
        if (!existsSync(path)) {
          throw new Error(`Voix absente : ${path}. Lancer « pnpm voices:fetch » dans frontend/.`);
        }
        if (statSync(path).size !== file.size || sha256(path) !== file.sha256) {
          throw new Error(
            `Voix non conforme à voices.lock.json : ${path}. Relancer « pnpm voices:fetch ».`,
          );
        }
      }
    }
  }

  let config: ResolvedConfig;
  let voicesRefused = false;

  return {
    name: 'piper-assets',
    config: () => ({
      define: {
        'import.meta.env.VITE_PIPER_MANIFEST': JSON.stringify(JSON.stringify(manifest)),
      },
      // Le runtime ONNX charge ses propres fichiers .mjs / .wasm par adresse : le
      // laisser hors du pré-bundling de Vite évite de les casser en développement.
      optimizeDeps: { exclude: ['onnxruntime-web'] },
    }),
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      if (config.command !== 'build') return;
      try {
        assertVoicesReady();
      } catch (error) {
        // closeBundle s'exécute aussi après un échec : sans ce drapeau, son erreur de copie
        // masquerait ce message clair.
        voicesRefused = true;
        throw error;
      }
    },
    configureServer(server) {
      if (
        !lock.models.every((m) => m.files.every((f) => existsSync(join(voicesDir, m.id, f.name))))
      ) {
        server.config.logger.warn(
          '\n[piper-assets] Voix absente : l’écoute audio ne marchera pas. Lancer « pnpm voices:fetch ».\n',
        );
      }
      const byUrl = new Map(assets.map((a) => [a.url, a]));
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const asset = byUrl.get(path);
        if (!asset || !existsSync(asset.source)) {
          next();
          return;
        }
        const name = path.slice(path.lastIndexOf('/') + 1);
        res.setHeader('Content-Type', contentType(name));
        res.setHeader('Content-Length', String(statSync(asset.source).size));
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Nos propres fichiers changent pendant le développement : pas d'« immutable ».
        const own =
          asset.kind === 'phonemizer' && (PHONEMIZER_OWN_FILES as readonly string[]).includes(name);
        res.setHeader('Cache-Control', own ? 'no-cache' : 'public, max-age=31536000, immutable');
        createReadStream(asset.source).pipe(res);
      });
    },
    // Copie plutôt qu'émission en mémoire : le modèle pèse 77 Mo.
    closeBundle() {
      if (config.command !== 'build' || voicesRefused) return;
      for (const asset of assets) {
        // `asset.url` commence par « / » : `resolve` le prendrait pour la racine du disque.
        const target = resolve(config.root, config.build.outDir, asset.url.slice(1));
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(asset.source, target);
      }
    },
  };
}
