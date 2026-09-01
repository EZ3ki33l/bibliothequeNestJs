import { apiFetch } from './api';

export type QuizQuestionPublic = {
  id: string;
  prompt: string;
  choices: string[];
};

export type QuizEntrySummary = {
  title: string;
  slug: string;
  summary: string;
};

export type QuizAttemptPublic = {
  id: string;
  score: null;
  questions: QuizQuestionPublic[];
};

export type StartQuizResponse = {
  attempt: QuizAttemptPublic | null;
  entry: QuizEntrySummary;
};

export type StartQuizResult = StartQuizResponse | 'unauthorized' | 'not_found';

export async function startQuiz(slug: string): Promise<StartQuizResult> {
  const response = await apiFetch('/quizzes/start', {
    method: 'POST',
    body: JSON.stringify({ slug }),
  });

  if (response.status === 401) {
    return 'unauthorized';
  }

  if (response.status === 404) {
    return 'not_found';
  }

  if (!response.ok) {
    throw new Error('Impossible de charger l’épreuve');
  }

  return response.json();
}

export type QuizAnswer = {
  questionId: string;
  choiceIndex: number;
};

export type SubmitQuizResponse = {
  id: string;
  score: number;
  correctCount: number;
  total: number;
  entry: QuizEntrySummary;
};

export type SubmitQuizResult = SubmitQuizResponse | 'unauthorized' | 'not_found' | 'bad_request';

export async function submitQuiz(
  attemptId: string,
  answers: QuizAnswer[],
): Promise<SubmitQuizResult> {
  const response = await apiFetch(`/quizzes/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });

  if (response.status === 401) {
    return 'unauthorized';
  }

  if (response.status === 404) {
    return 'not_found';
  }

  if (response.status === 400) {
    return 'bad_request';
  }

  if (!response.ok) {
    throw new Error('Impossible d’enregistrer le score');
  }

  return response.json();
}
