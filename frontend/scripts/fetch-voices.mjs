// Spec 020 : télécharge le modèle de voix de l'écoute audio dans .voices/.
//
// Le modèle pèse 77 Mo : il n'est ni dans git ni dans npm. Ce script le prend
// à l'adresse épinglée par voices.lock.json (commit Hugging Face), VÉRIFIE sa
// taille et son SHA-256, et échoue au moindre écart : un fichier remplacé en
// amont ne peut donc pas arriver jusqu'au site. Un fichier déjà présent et
// valide n'est pas retéléchargé.
//
// Usage : `pnpm voices:fetch` (dans frontend/). Code de sortie ≠ 0 en cas d'échec.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lock = JSON.parse(await readFile(join(root, 'voices.lock.json'), 'utf8'));
const outDir = join(root, '.voices');

async function sha256(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

// Vrai si le fichier existe avec la bonne taille ET la bonne somme.
async function isValid(path, file) {
  try {
    if ((await stat(path)).size !== file.size) return false;
    return (await sha256(path)) === file.sha256;
  } catch {
    return false;
  }
}

async function download(url, path, file) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!response.ok || response.body === null) {
    throw new Error(`réponse ${response.status} pour ${url}`);
  }
  // Fichier temporaire : un téléchargement interrompu ne laisse jamais un fichier partiel valide.
  const partial = `${path}.partial`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
    const { size } = await stat(partial);
    if (size !== file.size) throw new Error(`taille ${size} au lieu de ${file.size}`);
    const sum = await sha256(partial);
    if (sum !== file.sha256) throw new Error(`SHA-256 ${sum} au lieu de ${file.sha256}`);
    await rename(partial, path);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}

let failed = false;
for (const model of lock.models) {
  const dir = join(outDir, model.id);
  await mkdir(dir, { recursive: true });
  for (const file of model.files) {
    const path = join(dir, file.name);
    if (await isValid(path, file)) {
      console.log(`✓ ${model.id}/${file.name} (déjà présent, somme vérifiée)`);
      continue;
    }
    const url = `${lock.source.baseUrl}/${lock.source.commit}/${file.path}`;
    console.log(`↓ ${model.id}/${file.name} (${(file.size / 1e6).toFixed(1)} Mo)…`);
    try {
      await download(url, path, file);
      console.log(`✓ ${model.id}/${file.name} (téléchargé, somme vérifiée)`);
    } catch (error) {
      failed = true;
      console.error(`✗ ${model.id}/${file.name} : ${error.message}`);
    }
  }
}

if (failed) {
  console.error('\nTéléchargement refusé : un fichier ne correspond pas à voices.lock.json.');
  process.exit(1);
}
