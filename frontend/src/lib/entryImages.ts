import { messageFromNest } from './admin';
import { apiFetch } from './api';
import type { EntryIllustrationImage } from './illustrations';

/**
 * Images d'une fiche côté administration (spec 016, contracts/http.md).
 *
 * Comme `lib/admin.ts`, les écritures renvoient une **valeur** : un refus du
 * serveur (format, taille, droits, plafond, stockage indisponible) est un
 * message à afficher dans le formulaire, pas une panne.
 */

/** Une image vue par l'administration : la forme publique, plus les poids et la date d'envoi. */
export type EntryImageAdmin = EntryIllustrationImage & {
  readingBytes: number;
  fullBytes: number;
  createdAt: string;
};

/** Réponse d'un envoi : l'image et sa référence Markdown, prête à insérer dans le corps. */
export type UploadedEntryImage = EntryImageAdmin & { markdown: string };

export type ImageResult<T> = { ok: true; value: T } | { ok: false; message: string };

export type ImageUsage = { usedBytes: number; limitBytes: number; imageCount: number };

const SESSION_EXPIRED = 'La session a expiré : se reconnecter puis réessayer.';
const NETWORK_ERROR = 'Le serveur ne répond pas : réessayer dans un instant.';

/** Message d'un refus, avec l'heure du prochain essai pour un 429. */
async function refusal(response: Response): Promise<string> {
  if (response.status === 401) {
    return SESSION_EXPIRED;
  }

  if (response.status === 429) {
    try {
      const body = (await response.clone().json()) as { retryAt?: unknown };
      if (typeof body.retryAt === 'string') {
        const time = new Date(body.retryAt).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `Trop d’images envoyées : nouvel envoi possible vers ${time}.`;
      }
    } catch {
      // Corps illisible : le message générique suffit.
    }
  }

  return messageFromNest(response);
}

async function write<T>(path: string, init: RequestInit): Promise<ImageResult<T>> {
  let response: Response;
  try {
    response = await apiFetch(path, init);
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }

  if (!response.ok) {
    return { ok: false, message: await refusal(response) };
  }

  const value = response.status === 204 ? undefined : ((await response.json()) as T);
  return { ok: true, value: value as T };
}

/** Envoie une image pour une fiche. Le fichier part tel quel : c'est le serveur qui le vérifie et le réencode. */
export function uploadEntryImage(
  entryId: string,
  file: File,
  alt: string,
  caption: string,
): Promise<ImageResult<UploadedEntryImage>> {
  const body = new FormData();
  body.append('file', file);
  body.append('alt', alt);
  if (caption.trim() !== '') {
    body.append('caption', caption);
  }

  return write(`/admin/entries/${entryId}/images`, { method: 'POST', body });
}

export function updateEntryImage(
  entryId: string,
  imageId: string,
  fields: { alt?: string; caption?: string },
): Promise<ImageResult<EntryImageAdmin>> {
  return write(`/admin/entries/${entryId}/images/${imageId}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}

export function removeEntryImage(entryId: string, imageId: string): Promise<ImageResult<void>> {
  return write(`/admin/entries/${entryId}/images/${imageId}`, { method: 'DELETE' });
}

/** Volume occupé par les images. `null` en cas d'échec : le tableau de bord n'affiche alors rien. */
export async function getImageUsage(): Promise<ImageUsage | null> {
  try {
    const response = await apiFetch('/admin/images/usage');
    return response.ok ? ((await response.json()) as ImageUsage) : null;
  } catch {
    return null;
  }
}

/** Poids lisible : « 329 Ko », « 1,9 Mo », « 1,7 Go » (multiples de 1 024, comme les limites du serveur). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`;
}
