/** Un fichier conservé chez le prestataire : sa clé et son poids en octets. */
export type StoredFile = { key: string; size: number };

/** Un fichier à conserver : un nom (pour le prestataire) et son contenu. */
export type FileToStore = { name: string; body: Buffer };

/**
 * Jeton d'injection du stockage des images (spec 016).
 *
 * Même principe que `CONTACT_MAILER` : `ImageStorage` est une interface, qui
 * disparaît à la compilation, donc Nest a besoin d'un jeton pour savoir quoi
 * injecter. `EntryImagesService` ignore qu'UploadThing est derrière : le
 * prestataire peut changer (un stockage OVH, par exemple) sans toucher au
 * service ni aux adresses publiques des images, et les tests fournissent un
 * faux stockage, sans réseau.
 */
export const IMAGE_STORAGE = Symbol('IMAGE_STORAGE');

export interface ImageStorage {
  /**
   * Conserve les fichiers, dans l'ordre reçu. Tout ou rien : si un fichier
   * échoue, ceux qui ont réussi sont retirés et la méthode lève une
   * `ServiceUnavailableException`.
   */
  put(files: FileToStore[]): Promise<StoredFile[]>;

  /** Contenu d'un fichier, ou `null` s'il est introuvable ou si le prestataire ne répond pas. */
  read(key: string): Promise<Buffer | null>;

  /** Retire des fichiers. `false` en cas d'échec, sans exception : un retrait raté se rattrape. */
  remove(keys: string[]): Promise<boolean>;

  /** Tous les fichiers conservés, page après page (rapprochement des orphelins). */
  list(): AsyncIterable<StoredFile>;
}
