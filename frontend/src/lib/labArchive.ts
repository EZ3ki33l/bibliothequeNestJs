import { labPathRefusal } from './labFiles';
import { LAB_SECURITY_LINES, LAB_WARNING_LINES, LAB_WARNING_TITLE } from './labWarning';
import { LAB_HOST_LABEL, LAB_TOOL_LABEL } from './labels';
import type { EntryLab } from './stacks';

/**
 * Archive d'un laboratoire, fabriquée **dans le navigateur** (spec 018) à
 * partir de ce que la page a déjà reçu : aucune requête, aucune trace, et
 * l'accès est exactement celui de la fiche. Les résultats sont des valeurs,
 * pas des exceptions.
 */

export type LabArchiveResult = { ok: true } | { ok: false; message: string };

/** Date fixe : deux téléchargements donnent la même archive. */
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

/** Texte du `LISEZMOI.txt` : prérequis, avertissement, lancement, arrêt, fichiers. */
export function labReadme({
  title,
  entryUrl,
  lab,
}: {
  title: string;
  entryUrl: string;
  lab: EntryLab;
}): string {
  const warning = [...LAB_WARNING_LINES, ...(lab.securityLab ? LAB_SECURITY_LINES : [])];
  const paths = Object.keys(lab.files).sort();

  return [
    `${title} — laboratoire`,
    entryUrl,
    '',
    'PRÉREQUIS',
    `Outil : ${LAB_TOOL_LABEL[lab.tool]}`,
    `Logiciels : ${lab.software || 'non précisés'}`,
    `Mémoire : ${lab.ramGb} Go — Disque : ${lab.diskGb} Go`,
    `Systèmes hôtes : ${lab.hosts.map((host) => LAB_HOST_LABEL[host]).join(', ')}`,
    '',
    LAB_WARNING_TITLE.toUpperCase(),
    ...warning.map((line) => `- ${line}`),
    '',
    'LANCEMENT',
    lab.setupMd.trim() || '(non précisé)',
    '',
    'ARRÊT ET DESTRUCTION',
    lab.teardownMd.trim() || '(non précisé)',
    '',
    'FICHIERS',
    ...paths.map((path) => `- ${path}`),
    '',
  ].join('\n');
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Dernier composant d'un chemin : le nom sous lequel un fichier seul est enregistré. */
function baseName(path: string): string {
  return path.split('/').pop() ?? path;
}

/**
 * Télécharge `<slug>-laboratoire.zip`. Chaque chemin est **revérifié** avant la
 * construction : un refus arrête tout, même si une donnée avait contourné la
 * validation du serveur. `fflate` n'est chargé qu'au premier clic.
 */
export async function downloadLabArchive(
  slug: string,
  title: string,
  lab: EntryLab,
): Promise<LabArchiveResult> {
  for (const path of Object.keys(lab.files)) {
    const refusal = labPathRefusal(path);
    if (refusal) {
      return {
        ok: false,
        message: `Archive non produite : fichier « ${path} », ${refusal}.`,
      };
    }
  }

  try {
    const { zipSync, strToU8 } = await import('fflate');
    const root = `${slug}-laboratoire`;
    const entries: Record<string, [Uint8Array, { os: number; attrs: number; mtime: Date }]> = {};

    // `os: 3` (Unix) : les attributs portent les droits d'accès.
    const add = (path: string, content: string, mode: number) => {
      entries[`${root}/${path}`] = [
        strToU8(content),
        { os: 3, attrs: (0o100000 | mode) << 16, mtime: FIXED_DATE },
      ];
    };

    for (const [path, content] of Object.entries(lab.files)) {
      add(path, content, path.endsWith('.sh') ? 0o755 : 0o644);
    }
    add(
      'LISEZMOI.txt',
      labReadme({ title, entryUrl: `${window.location.origin}/entries/${slug}`, lab }),
      0o644,
    );

    const zip = zipSync(entries);
    save(new Blob([zip as BlobPart], { type: 'application/zip' }), `${root}.zip`);
    return { ok: true };
  } catch {
    return { ok: false, message: 'L’archive n’a pas pu être produite.' };
  }
}

/** Télécharge un fichier seul, sans archive. */
export function downloadLabFile(path: string, content: string): LabArchiveResult {
  const refusal = labPathRefusal(path);
  if (refusal) {
    return { ok: false, message: `Fichier « ${path} » non téléchargé : ${refusal}.` };
  }
  save(new Blob([content], { type: 'text/plain;charset=utf-8' }), baseName(path));
  return { ok: true };
}
