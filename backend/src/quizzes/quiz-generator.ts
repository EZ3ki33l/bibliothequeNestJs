/** Une question de QCM, avec sa bonne réponse — donc jamais envoyée telle quelle au client. */
export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  /** Index de la bonne proposition dans `choices` (0 = la première). */
  correctIndex: number;
};

/**
 * Jeton d'injection du générateur.
 *
 * `QuizGenerator` est une interface TypeScript : elle n'existe plus à
 * l'exécution, Nest ne peut donc pas s'en servir pour retrouver quoi injecter.
 * Ce `Symbol` sert de nom stable, associé à une implémentation dans
 * `QuizzesModule`.
 */
export const QUIZ_GENERATOR = Symbol('QUIZ_GENERATOR');

/**
 * Contrat d'un générateur de QCM.
 *
 * `null` signifie « je n'ai pas pu produire de questions fiables ». Le service
 * en fait un 503 : pas d'examen plutôt qu'un mauvais examen.
 */
export interface QuizGenerator {
  generate(input: {
    title: string;
    summary: string;
    bodyMdx: string;
  }): Promise<QuizQuestion[] | null>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Valide des questions venues de l'extérieur (réponse d'un modèle de langage)
 * **ou** relues depuis une colonne JSON de la base.
 *
 * Le paramètre est `unknown` et non `QuizQuestion[]` : c'est le point d'entrée
 * de données non fiables, tout doit être vérifié avant d'être utilisé.
 *
 * Aucune réparation partielle : à la première anomalie, la fonction renvoie
 * `null` et le QCM entier est refusé. Garder « les questions valides » d'un lot
 * douteux, c'est risquer un examen dont la bonne réponse est fausse — bien plus
 * grave qu'une épreuve indisponible.
 *
 * Une colonne JSON peut aussi contenir un instantané d'une ancienne version du
 * format ; cette relecture protège donc aussi contre les données héritées.
 */
export function parseQuizQuestions(value: unknown): QuizQuestion[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  // Les identifiants servent de clés côté client et de nom de champ dans le
  // formulaire : un doublon rendrait deux questions indistinguables.
  const ids = new Set<string>();
  const questions: QuizQuestion[] = [];

  for (const item of value) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return null;
    }

    const record = item as Record<string, unknown>;
    const id = record.id;
    const prompt = record.prompt;
    const choices = record.choices;
    const correctIndex = record.correctIndex;

    if (!isNonEmptyString(id) || ids.has(id) || !isNonEmptyString(prompt)) {
      return null;
    }

    // Moins de deux propositions n'est pas un choix ; plus de huit ne tient pas
    // à l'écran.
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 8) {
      return null;
    }
    if (!choices.every(isNonEmptyString)) {
      return null;
    }

    // La bonne réponse doit désigner une proposition qui existe vraiment.
    if (
      typeof correctIndex !== 'number' ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= choices.length
    ) {
      return null;
    }

    ids.add(id);
    questions.push({ id, prompt, choices, correctIndex });
  }

  return questions;
}

/**
 * Version envoyable au client : `correctIndex` est retiré.
 *
 * Sans cette projection, la bonne réponse partirait dans la réponse HTTP et
 * serait lisible dans l'onglet réseau du navigateur — l'examen n'aurait plus
 * aucun sens.
 */
export function toPublicQuestions(questions: QuizQuestion[]) {
  return questions.map(({ id, prompt, choices }) => ({ id, prompt, choices }));
}
