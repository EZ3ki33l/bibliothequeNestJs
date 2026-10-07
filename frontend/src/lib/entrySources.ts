/**
 * Sources et vérification d'une fiche : types et règles d'affichage.
 *
 * Les fonctions sont **pures** (même entrée, même sortie, ni DOM ni réseau).
 * La page publique et l'aperçu de l'administration passent par elles : ce qui
 * décide d'un lien ou d'une mention n'est écrit qu'ici.
 */

/** Source telle que l'API la renvoie, dans l'ordre saisi. */
export type EntrySource = {
  title: string;
  url: string;
  /** Chaîne vide : éditeur non renseigné. */
  publisher: string;
  /** Jour de consultation, `AAAA-MM-JJ`. */
  consultedOn: string | null;
  licenseName: string;
  licenseUrl: string;
  /** `true` : la fiche est une adaptation de ce document. */
  adapted: boolean;
};

/**
 * Source telle que le formulaire l'envoie : les champs facultatifs laissés
 * vides sont omis, le serveur applique ses défauts.
 */
export type EntrySourceInput = {
  title: string;
  url: string;
  publisher?: string;
  consultedOn?: string;
  licenseName?: string;
  licenseUrl?: string;
  adapted: boolean;
};

/** Saisie → forme d'affichage : l'aperçu rend ce que l'API renverrait. */
export function toDisplayedSource(input: EntrySourceInput): EntrySource {
  return {
    title: input.title,
    url: input.url,
    publisher: input.publisher ?? '',
    consultedOn: input.consultedOn ?? null,
    licenseName: input.licenseName ?? '',
    licenseUrl: input.licenseUrl ?? '',
    adapted: input.adapted,
  };
}

/**
 * Vrai seulement pour une adresse absolue en `https:`.
 *
 * Le serveur refuse déjà tout autre protocole à l'enregistrement. Ce test est
 * une seconde barrière, à l'affichage : un lien `javascript:` arrivé en base
 * par un autre chemin s'exécuterait au clic, dans la session du lecteur — ou
 * de l'administrateur qui relit. Tout ce qui n'est pas `https:` est refusé,
 * sans chercher à énumérer ce qui est dangereux (fail closed).
 */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    // Adresse relative ou illisible : `new URL` lève sans base.
    return false;
  }
}

/**
 * `timeZone: 'UTC'` : un jour `AAAA-MM-JJ` est lu par `Date` comme minuit UTC.
 * Formaté dans le fuseau du navigateur, il reculerait d'un jour à l'ouest de
 * Greenwich.
 */
const LONG_DAY = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });

/** `2026-10-06` → « 6 octobre 2026 ». Une valeur illisible est rendue telle quelle. */
export function formatLongDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? day : LONG_DAY.format(date);
}

/** `AAAA-MM-JJ` du jour courant, dans le fuseau du navigateur. */
export function todayAsDay(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Mention de l'en-tête : « Vérifié le 6 octobre 2026 · React 19 ».
 *
 * `null` sans date, **même si une version est renseignée** : une version
 * seule ne dit pas quand elle a été vérifiée, et rien ne vaut mieux qu'une
 * mention approximative.
 */
export function verificationLabel(verifiedOn: string | null, version: string): string | null {
  if (verifiedOn === null) {
    return null;
  }

  const label = `Vérifié le ${formatLongDay(verifiedOn)}`;

  return version === '' ? label : `${label} · ${version}`;
}
