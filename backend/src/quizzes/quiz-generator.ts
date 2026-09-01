export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
};

export const QUIZ_GENERATOR = Symbol('QUIZ_GENERATOR');

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

export function parseQuizQuestions(value: unknown): QuizQuestion[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

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

    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 8) {
      return null;
    }
    if (!choices.every(isNonEmptyString)) {
      return null;
    }
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

export function toPublicQuestions(questions: QuizQuestion[]) {
  return questions.map(({ id, prompt, choices }) => ({ id, prompt, choices }));
}
