/**
 * Identité de publication affichée sur les pages légales et contact.
 *
 * Ce n’est pas une table Prisma ni un endpoint Nest : le visiteur lit du
 * texte statique. Tant que l’éditeur réel n’est pas connu, chaque champ
 * reste un placeholder explicite — jamais un nom, un SIRET ou un hébergeur
 * inventé (FR-010 / SC-007).
 *
 * Quand tu auras les vrais renseignements, tu changes uniquement ce fichier.
 * Les pages (mentions, contact) le lisent ; elles ne recopient pas les valeurs.
 */
export type SiteLegal = {
  publisherName: string;
  publisherAddress: string;
  publicationDirector: string;
  hostName: string;
  hostAddress: string;
  contactEmail: string;
};

/** Mention unique : un champ est « incomplet » s’il la contient. */
export const LEGAL_PLACEHOLDER = 'À renseigner avant mise en ligne';

export const SITE_LEGAL: SiteLegal = {
  publisherName: LEGAL_PLACEHOLDER,
  publisherAddress: LEGAL_PLACEHOLDER,
  publicationDirector: LEGAL_PLACEHOLDER,
  hostName: LEGAL_PLACEHOLDER,
  hostAddress: LEGAL_PLACEHOLDER,
  contactEmail: LEGAL_PLACEHOLDER,
};

/**
 * True si la valeur est encore un placeholder (recherche insensible à la casse).
 * Les pages MUST afficher la mention telle quelle, pas une identité de secours.
 */
export function isLegalPlaceholder(value: string): boolean {
  return value.toLowerCase().includes('à renseigner');
}

/**
 * Autorise un lien `mailto:` seulement si le courriel est réel.
 *
 * Un placeholder du type « À renseigner… » n’est pas une adresse : un
 * `mailto:` dessus ouvrirait un client mail cassé. La page contact (phase 6)
 * affichera le texte, mais sans lien cliquable tant que ce helper renvoie false.
 */
export function canUseMailto(email: string): boolean {
  if (isLegalPlaceholder(email)) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
