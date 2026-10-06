/**
 * Identité de publication affichée sur les mentions légales.
 *
 * Ce n’est pas une table Prisma ni un endpoint Nest : le visiteur lit du
 * texte statique. Les pages lisent uniquement cet objet.
 *
 * Site personnel non professionnel et sans contrepartie financière : régime
 * de l’article 1-1, II de la loi n° 2004-575 (LCEN, ex-article 6-III depuis la
 * loi SREN de 2024). Publiquement, seul l’hébergeur est obligatoire ; le
 * domicile et le téléphone de l’éditeur sont communiqués à l’hébergeur, pas
 * publiés. Le nom de l’éditeur reste affiché : il identifie le responsable de
 * traitement des données des comptes (RGPD, art. 13).
 *
 * Volontairement absents : directeur de publication (notion propre aux
 * éditeurs professionnels) et courriel (le contact passe par un formulaire,
 * l’adresse ne doit pas figurer dans le bundle du navigateur).
 *
 * Si le site devient professionnel (publicité, affiliation, offre payante),
 * les mentions complètes deviennent obligatoires : à revoir avant.
 */
export type SiteLegal = {
  publisherName: string;
  hostName: string;
  hostAddress: string;
};

export const SITE_LEGAL: SiteLegal = {
  publisherName: 'Romain Rousset',
  hostName: 'OVH SAS',
  hostAddress: '2 rue Kellermann, 59100 Roubaix, France',
};
