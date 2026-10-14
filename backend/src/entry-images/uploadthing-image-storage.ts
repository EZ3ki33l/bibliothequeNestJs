import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UTApi, UTFile } from 'uploadthing/server';
import { withTimeout } from '../common/with-timeout';
import type { FileToStore, ImageStorage, StoredFile } from './image-storage';

export const STORAGE_UNAVAILABLE = 'Le stockage des images est indisponible.';

const UPLOAD_TIMEOUT_MS = 30_000;
const READ_TIMEOUT_MS = 10_000;
const REMOVE_TIMEOUT_MS = 10_000;

/** Une version pleine pèse 2 Mo au plus : au-delà, la réponse du prestataire n'est pas lue. */
const MAX_READ_BYTES = 2.5 * 1024 * 1024;

/** Forme d'une clé du prestataire : rien qui puisse changer le chemin de l'adresse. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const APP_ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;

/**
 * Identifiant d'application lu dans le jeton UploadThing : un JSON encodé en
 * base64 qui contient `apiKey`, `appId` et `regions` (constaté le 2026-10-14).
 * `null` si le jeton est absent ou illisible. Le jeton n'est jamais journalisé.
 */
export function appIdFromToken(token: string | undefined): string | null {
  if (!token) {
    return null;
  }

  try {
    const decoded: unknown = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const appId = (decoded as { appId?: unknown } | null)?.appId;
    return typeof appId === 'string' && APP_ID_PATTERN.test(appId) ? appId : null;
  } catch {
    return null;
  }
}

/**
 * Stockage des images chez UploadThing (spec 016, research § 6).
 *
 * - Les fichiers partent **du serveur** (`UTApi`), jamais du navigateur : un
 *   envoi direct contournerait la vérification et le réencodage.
 * - Seule la clé est conservée en base ; l'adresse de lecture se reconstruit
 *   ici (`https://<APP_ID>.ufs.sh/f/<clé>`). Si le prestataire change encore de
 *   domaine, seul ce fichier change.
 * - L'adresse d'amont est construite à partir d'une clé tirée de la base,
 *   jamais d'une donnée de la requête : aucune falsification de requête côté
 *   serveur (SSRF) n'est possible.
 * - Sans jeton, rien ne plante au démarrage : l'envoi échoue (503), la lecture
 *   renvoie `null`.
 */
@Injectable()
export class UploadThingImageStorage implements ImageStorage {
  private readonly logger = new Logger(UploadThingImageStorage.name);

  constructor(private readonly config: ConfigService) {}

  private token(): string | undefined {
    return this.config.get<string>('UPLOADTHING_TOKEN')?.trim() || undefined;
  }

  private api(): UTApi | null {
    const token = this.token();
    return token && appIdFromToken(token) ? new UTApi({ token, logLevel: 'Error' }) : null;
  }

  async put(files: FileToStore[]): Promise<StoredFile[]> {
    const api = this.api();
    if (!api) {
      this.logger.warn('Image upload skipped : UPLOADTHING_TOKEN is not set or unreadable');
      throw new ServiceUnavailableException(STORAGE_UNAVAILABLE);
    }

    let results: Awaited<ReturnType<UTApi['uploadFiles']>>;
    try {
      results = await withTimeout(
        api.uploadFiles(
          files.map(
            // Copie en `Uint8Array` : le type `Blob` refuse un `Buffer` adossé à un `SharedArrayBuffer`.
            (file) => new UTFile([Uint8Array.from(file.body)], file.name, { type: 'image/webp' }),
          ),
          { contentDisposition: 'inline' },
        ),
        UPLOAD_TIMEOUT_MS,
      );
    } catch (err) {
      this.logger.warn(`Image upload failed : ${err instanceof Error ? err.name : 'unknown'}`);
      throw new ServiceUnavailableException(STORAGE_UNAVAILABLE);
    }

    const stored = results.flatMap((result) =>
      result.data ? [{ key: result.data.key, size: result.data.size }] : [],
    );

    // Tout ou rien : un fichier manquant fait retirer ceux qui sont passés.
    if (stored.length !== files.length) {
      this.logger.warn('Image upload partially failed : stored files removed');
      await this.remove(stored.map((file) => file.key));
      throw new ServiceUnavailableException(STORAGE_UNAVAILABLE);
    }

    return stored;
  }

  async read(key: string): Promise<Buffer | null> {
    const appId = appIdFromToken(this.token());
    if (!appId || !KEY_PATTERN.test(key)) {
      return null;
    }

    try {
      const response = await fetch(`https://${appId}.ufs.sh/f/${key}`, {
        signal: AbortSignal.timeout(READ_TIMEOUT_MS),
        redirect: 'error',
      });

      if (!response.ok || response.headers.get('content-type') !== 'image/webp' || !response.body) {
        return null;
      }

      // Lecture bornée : on s'arrête dès que la réponse dépasse ce qu'une
      // version d'image peut peser.
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of response.body) {
        total += chunk.length;
        if (total > MAX_READ_BYTES) {
          return null;
        }
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (err) {
      this.logger.warn(`Image read failed : ${err instanceof Error ? err.name : 'unknown'}`);
      return null;
    }
  }

  async remove(keys: string[]): Promise<boolean> {
    if (keys.length === 0) {
      return true;
    }

    const api = this.api();
    if (!api) {
      return false;
    }

    try {
      const result = await withTimeout(api.deleteFiles(keys), REMOVE_TIMEOUT_MS);
      return result.success;
    } catch (err) {
      this.logger.warn(`Image removal failed : ${err instanceof Error ? err.name : 'unknown'}`);
      return false;
    }
  }

  async *list(): AsyncIterable<StoredFile> {
    const api = this.api();
    if (!api) {
      throw new ServiceUnavailableException(STORAGE_UNAVAILABLE);
    }

    let offset = 0;
    for (;;) {
      const page = await api.listFiles({ limit: 500, offset });
      for (const file of page.files) {
        yield { key: file.key, size: file.size };
      }
      if (!page.hasMore || page.files.length === 0) {
        return;
      }
      offset += page.files.length;
    }
  }
}
