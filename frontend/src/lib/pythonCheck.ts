import type { RunStatus } from './pythonRunner';
import type { SandpackFiles } from './stacks';

/**
 * Règles pures de l'atelier Python (spec 017) : vérification d'un exercice et
 * manques signalés au rédacteur. Ni DOM ni réseau.
 */

/**
 * Normalise une sortie avant comparaison. Ignoré : la nature des fins de ligne
 * (`\r\n`, `\r`), les espaces et tabulations en fin de ligne, les lignes vides
 * en fin de texte — ce qu'un terminal ne montre pas. Tout le reste compte :
 * majuscules, espaces intérieurs, ponctuation, lignes vides intérieures.
 */
export function normalizeOutput(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export type OutputComparison =
  | { passed: true }
  /** `line` commence à 1 ; `null` : la ligne n'existe pas de ce côté. */
  | { passed: false; line: number; expected: string | null; actual: string | null };

/** Compare la sortie obtenue à la sortie attendue ; renvoie la première différence. */
export function compareOutput(expected: string, actual: string): OutputComparison {
  const want = normalizeOutput(expected);
  const got = normalizeOutput(actual);
  for (let index = 0; index < Math.max(want.length, got.length); index++) {
    if (want[index] !== got[index]) {
      return {
        passed: false,
        line: index + 1,
        expected: want[index] ?? null,
        actual: got[index] ?? null,
      };
    }
  }
  return { passed: true };
}

/** Ce qui a empêché la comparaison : une exécution qui n'a pas fini normalement. */
export type CheckCause = Exclude<RunStatus, 'ok'>;

export type CheckOutcome = OutputComparison | { passed: false; cause: CheckCause };

/**
 * Verdict de « Vérifier » : la sortie standard seule est comparée (les erreurs
 * ne comptent pas comme sortie), et seulement si l'exécution a fini sans
 * erreur, arrêt ni dépassement. Rien n'est enregistré ni envoyé.
 */
export function checkOutcome(status: RunStatus, expected: string, stdout: string): CheckOutcome {
  return status === 'ok' ? compareOutput(expected, stdout) : { passed: false, cause: status };
}

/** Même règle que l'exécuteur (`public/python-runner/runner.js`) : un nom de module simple, sans dossier. */
export function isPythonFileName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*\.py$/.test(name);
}

/** Manques d'un atelier Python qui a des fichiers ; indicatifs, comme les autres. */
export function pythonPlaygroundGaps(files: SandpackFiles): string[] {
  const gaps: string[] = [];
  if (!Object.hasOwn(files, 'main.py')) {
    gaps.push('Aucun script principal main.py : l’atelier ne pourra pas s’exécuter.');
  }
  if (Object.keys(files).some((name) => !isPythonFileName(name))) {
    gaps.push('Un fichier de l’atelier Python n’est pas un fichier .py : il sera ignoré.');
  }
  return gaps;
}
