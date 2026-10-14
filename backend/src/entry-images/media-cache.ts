/** Volume total du cache. */
export const MEDIA_CACHE_MAX_BYTES = 64 * 1024 * 1024;

/** Au-delà, un fichier n'est pas gardé (une version pleine pèse 2 Mo au plus). */
export const MEDIA_CACHE_MAX_ENTRY_BYTES = 2.5 * 1024 * 1024;

/**
 * Cache mémoire du relais des images (spec 016, research § 7).
 *
 * Il évite de redemander au prestataire les images vues par plusieurs
 * lecteurs, et continue de servir une image déjà vue si le prestataire ne
 * répond plus. Le cache du navigateur (un an, `immutable`) fait le reste.
 *
 * LRU (le moins récemment utilisé part en premier) écrit sur une `Map` : elle
 * garde l'ordre d'insertion, donc réinsérer une clé à chaque lecture la place
 * en fin de file, et la première clé est toujours la plus ancienne.
 *
 * Volontairement en mémoire, borné : le perdre au redémarrage n'a d'autre
 * effet qu'un nouveau téléchargement chez le prestataire.
 *
 * Pas de `@Injectable()` : Nest essaierait d'injecter les deux limites du
 * constructeur. Le module fournit une instance toute faite (`useValue`), et
 * les tests en créent une avec de petites limites.
 */
export class MediaCache {
  private readonly entries = new Map<string, Buffer>();
  private totalBytes = 0;

  constructor(
    private readonly maxBytes = MEDIA_CACHE_MAX_BYTES,
    private readonly maxEntryBytes = MEDIA_CACHE_MAX_ENTRY_BYTES,
  ) {}

  get(key: string): Buffer | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      // Lu à l'instant : il passe en fin de file.
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: Buffer): void {
    if (value.length > this.maxEntryBytes) {
      return;
    }

    this.delete(key);
    this.entries.set(key, value);
    this.totalBytes += value.length;

    for (const [oldestKey, oldest] of this.entries) {
      if (this.totalBytes <= this.maxBytes) {
        break;
      }
      this.entries.delete(oldestKey);
      this.totalBytes -= oldest.length;
    }
  }

  delete(key: string): void {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.totalBytes -= value.length;
    }
  }

  /** Volume occupé, pour les tests. */
  get size(): number {
    return this.totalBytes;
  }
}
