/**
 * Destination de retour après une connexion ou une inscription (`?retour=`).
 *
 * Le risque : la **redirection ouverte**. Si la page de connexion suivait
 * n'importe quelle adresse, un lien `…/login?retour=https://site-pirate`
 * enverrait un apprenant, rassuré par la vraie page de connexion, vers une
 * copie du site qui lui redemande son mot de passe. Le paramètre est lisible et
 * modifiable par n'importe qui : il n'est jamais suivi tel quel.
 *
 * La règle : seul un **chemin interne** est accepté. `//hote` est refusé
 * explicitement, car c'est une adresse « relative au protocole » : elle commence
 * bien par `/`, mais le navigateur y lit un autre site. Idem `/\hote`, que les
 * navigateurs traitent comme `//hote`.
 *
 * Fonctions pures (l'origine est un paramètre) : elles se testent sans
 * navigateur le jour où le dépôt a un runner de tests.
 */

/**
 * Pages d'authentification : y revenir après s'être connecté n'a aucun sens.
 * `/adresse-verifiee` en fait partie : c'est la page d'arrivée du lien de
 * vérification, elle porte elle-même la destination à rejoindre (`?retour=`).
 */
const AUTH_PATHS = [
  '/login',
  '/register',
  '/mot-de-passe-oublie',
  '/reinitialiser-mot-de-passe',
  '/adresse-verifiee',
];

const HOME = '/';

function isAuthPath(pathname: string): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Séquence `%` mal formée : la comparaison se fait sur la valeur brute.
  }

  // Le routeur ignore la casse et la barre finale : la comparaison aussi.
  const normalized = decoded.toLowerCase();
  return AUTH_PATHS.some((path) => normalized === path || normalized.startsWith(`${path}/`));
}

/**
 * Chemin interne à suivre après connexion, ou `'/'` si `raw` n'en est pas un.
 *
 * À appeler **au moment de naviguer**, pas seulement en écrivant le lien :
 * l'adresse de la page de connexion peut avoir été écrite par quelqu'un d'autre.
 */
export function safeReturnTo(raw: string | null, origin: string = window.location.origin): string {
  if (!raw) {
    return HOME;
  }

  // Un seul `/` en tête : ni adresse absolue (`https:…`, `javascript:…`), ni
  // `//hote`. Aucune barre oblique inversée ni caractère de contrôle : le
  // navigateur retire les tabulations et retours à la ligne d'une adresse, ce
  // qui transformerait `/<tab>/hote` en `//hote`.
  // eslint-disable-next-line no-control-regex
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(raw)) {
    return HOME;
  }

  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return HOME;
  }

  if (url.origin !== origin) {
    return HOME;
  }

  // L'analyse résout les segments `.` et `..` : `/.//hote` devient `//hote`.
  // Le contrôle est donc refait sur le chemin **obtenu**, celui qui sera suivi.
  if (url.pathname.startsWith('//') || isAuthPath(url.pathname)) {
    return HOME;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Destination à retenir depuis la page courante.
 *
 * Sur une page d'authentification, ce n'est pas la page elle-même mais la
 * destination qu'elle porte déjà : passer de la connexion à l'inscription ne
 * doit pas la faire perdre.
 */
export function currentReturnTo(
  location: { pathname: string; search: string; hash?: string },
  origin: string = window.location.origin,
): string {
  if (isAuthPath(location.pathname)) {
    return safeReturnTo(new URLSearchParams(location.search).get('retour'), origin);
  }

  return safeReturnTo(`${location.pathname}${location.search}${location.hash ?? ''}`, origin);
}

function authHref(page: '/login' | '/register', current: string, origin?: string): string {
  const destination = safeReturnTo(current, origin);

  // Sans destination utile, l'adresse reste nue : l'accueil est le défaut.
  return destination === HOME ? page : `${page}?retour=${encodeURIComponent(destination)}`;
}

/** Adresse de la connexion qui ramènera à `current` (chemin interne, paramètres compris). */
export function loginHref(current: string, origin?: string): string {
  return authHref('/login', current, origin);
}

/** Adresse de l'inscription qui ramènera à `current`. */
export function registerHref(current: string, origin?: string): string {
  return authHref('/register', current, origin);
}
