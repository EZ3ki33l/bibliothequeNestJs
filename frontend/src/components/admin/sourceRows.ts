import { isHttpsUrl, type EntrySource, type EntrySourceInput } from '../../lib/entrySources';

/**
 * Passerelle entre la saisie des sources et le format attendu par l'API.
 *
 * Même rôle que `keyValuePairs.ts` pour les fichiers du playground : le
 * formulaire manipule des **lignes** (on ajoute, on retire, on déplace), l'API
 * reçoit une liste de sources propres. L'`id` est la clé React de la ligne ; il
 * n'est jamais envoyé.
 */
export type SourceRow = {
  /** Identité stable de la ligne, jamais envoyée au serveur. */
  id: string;
  title: string;
  url: string;
  publisher: string;
  /** Chaîne vide ou `AAAA-MM-JJ` : la valeur d'un `<input type="date">`. */
  consultedOn: string;
  licenseName: string;
  licenseUrl: string;
  adapted: boolean;
};

/** Même plafond que le serveur (`MAX_ENTRY_SOURCES`), qui reste le contrôle. */
export const MAX_SOURCES = 10;

export function emptySourceRow(): SourceRow {
  return {
    id: crypto.randomUUID(),
    title: '',
    url: '',
    publisher: '',
    consultedOn: '',
    licenseName: '',
    licenseUrl: '',
    adapted: false,
  };
}

/** Sources venues de l'API → lignes du formulaire (modification, duplication). */
export function sourcesToRows(sources: EntrySource[]): SourceRow[] {
  return sources.map((source) => ({
    id: crypto.randomUUID(),
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    consultedOn: source.consultedOn ?? '',
    licenseName: source.licenseName,
    licenseUrl: source.licenseUrl,
    adapted: source.adapted,
  }));
}

/** Vrai si rien n'a été saisi sur la ligne : elle est alors ignorée. */
function isBlank(row: SourceRow): boolean {
  return [
    row.title,
    row.url,
    row.publisher,
    row.consultedOn,
    row.licenseName,
    row.licenseUrl,
  ].every((value) => value.trim() === '');
}

/**
 * Lignes du formulaire → sources à envoyer, ou message d'erreur.
 *
 * La validation locale donne un message qui désigne la source et le champ,
 * avant tout appel réseau. Elle n'est pas le contrôle : le serveur refuse les
 * mêmes saisies (400), pour un client qui contournerait le formulaire.
 *
 * - une ligne entièrement vide est ignorée ;
 * - le titre et le lien sont requis ;
 * - un lien, comme le lien de la licence, commence par `https://` ;
 * - la date de consultation n'est pas dans le futur.
 *
 * `today` est un paramètre (`AAAA-MM-JJ`) : la fonction reste pure. Le numéro
 * annoncé est le rang de la ligne à l'écran, lignes vides comprises.
 */
export function rowsToSources(
  rows: SourceRow[],
  today: string,
): { ok: true; value: EntrySourceInput[] } | { ok: false; message: string } {
  const sources: EntrySourceInput[] = [];

  for (const [index, row] of rows.entries()) {
    if (isBlank(row)) {
      continue;
    }

    const label = `Source ${index + 1}`;
    const title = row.title.trim();
    const url = row.url.trim();
    const publisher = row.publisher.trim();
    const licenseName = row.licenseName.trim();
    const licenseUrl = row.licenseUrl.trim();

    if (title === '') {
      return { ok: false, message: `${label} : le titre est requis.` };
    }
    if (!isHttpsUrl(url)) {
      return { ok: false, message: `${label} : le lien doit commencer par https://.` };
    }
    if (licenseUrl !== '' && !isHttpsUrl(licenseUrl)) {
      return {
        ok: false,
        message: `${label} : le lien de la licence doit commencer par https://.`,
      };
    }
    // Deux jours `AAAA-MM-JJ` se comparent par ordre alphabétique.
    if (row.consultedOn > today) {
      return { ok: false, message: `${label} : la date de consultation est dans le futur.` };
    }

    // Un champ facultatif laissé vide est omis : le serveur applique son défaut.
    const source: EntrySourceInput = { title, url, adapted: row.adapted };
    if (publisher !== '') source.publisher = publisher;
    if (row.consultedOn !== '') source.consultedOn = row.consultedOn;
    if (licenseName !== '') source.licenseName = licenseName;
    if (licenseUrl !== '') source.licenseUrl = licenseUrl;

    sources.push(source);
  }

  if (sources.length > MAX_SOURCES) {
    return { ok: false, message: 'Dix sources au plus par fiche.' };
  }

  return { ok: true, value: sources };
}
