import { SANDPACK_TEMPLATES } from './sandpack';

/**
 * Environnements du playground d'une fiche : les modèles Sandpack (web), plus
 * `python`, l'atelier Python exécuté dans le navigateur (spec 017). Même liste
 * que `PLAYGROUND_TEMPLATES` côté serveur (`entries/dto/playground.ts`), qui
 * refuse toute autre valeur.
 */
export const PYTHON_TEMPLATE = 'python';

export const PLAYGROUND_ENVIRONMENTS = [...SANDPACK_TEMPLATES, PYTHON_TEMPLATE] as const;

/** Entrée et sortie attendue d'un atelier Python : même borne que le serveur (`MAX_PLAYGROUND_TEXT_LENGTH`). */
export const MAX_PLAYGROUND_TEXT_LENGTH = 10_000;

export function isPythonTemplate(template: string): boolean {
  return template === PYTHON_TEMPLATE;
}

/** Libellé du `<select>` du formulaire : le nom du modèle, sauf pour Python. */
export function environmentLabel(template: string): string {
  return isPythonTemplate(template) ? 'Python (exécuté dans le navigateur)' : template;
}
