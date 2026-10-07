/**
 * Signalement d'une erreur sur une fiche.
 *
 * Le signalement n'est pas une donnée : c'est un message de contact ordinaire
 * dont le texte de départ cite la fiche. Rien n'est enregistré, et le
 * formulaire de contact garde toutes ses protections.
 *
 * L'adresse ne transporte que le **slug** de la fiche. Si elle portait le
 * texte du message, n'importe qui pourrait fabriquer un lien préremplissant un
 * texte arbitraire sur le site. Avec un slug, le seul texte injecté vient d'une
 * fiche publiée, relue auprès du serveur par la page de contact.
 */

/** Nom du paramètre d'adresse lu par la page de contact. */
export const REPORT_PARAM = 'fiche';

/**
 * Longueur maximale du titre repris dans le message. Un titre n'a pas de
 * limite côté serveur, le message en a une (2000 caractères) : le titre est
 * tronqué pour que le texte de départ reste toujours envoyable.
 */
const MAX_TITLE_LENGTH = 120;

/** `/contact?fiche=<slug>` */
export function reportHref(entrySlug: string): string {
  return `/contact?${REPORT_PARAM}=${encodeURIComponent(entrySlug)}`;
}

/**
 * Texte de départ du message : la fiche concernée, son adresse, puis une
 * ligne à compléter. Le lecteur peut tout modifier avant l'envoi.
 *
 * `origin` est un paramètre (`window.location.origin` chez l'appelant) : la
 * fonction reste pure.
 */
export function reportMessage(entry: { title: string; slug: string }, origin: string): string {
  const title =
    entry.title.length > MAX_TITLE_LENGTH
      ? `${entry.title.slice(0, MAX_TITLE_LENGTH)}…`
      : entry.title;

  return [
    `Signalement d’une erreur sur la fiche « ${title} »`,
    `${origin}/entries/${encodeURIComponent(entry.slug)}`,
    '',
    'Erreur constatée : ',
  ].join('\n');
}
