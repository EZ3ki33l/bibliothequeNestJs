import { apiFetch } from './api';

/**
 * Appels de l'épreuve (QCM généré par un modèle de langage).
 *
 * Principe de ces types : le navigateur ne reçoit **jamais** la bonne réponse
 * avant d'avoir répondu. La correction se fait entièrement côté serveur ; ici,
 * on ne peut donc pas tricher en lisant la réponse du réseau.
 */

/** Question telle qu'envoyée pendant l'épreuve : sans `correctIndex`. */
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

/**
 * Tentative en cours. `score: null` (et non `number | null`) dit au compilateur
 * qu'une tentative non corrigée n'a pas de score : impossible d'afficher un
 * récapitulatif par erreur à partir de cet objet.
 */
export type QuizAttemptPublic = {
  id: string;
  score: null;
  questions: QuizQuestionPublic[];
};

/** `attempt: null` = cette fiche n'a pas d'épreuve (contenu trop court). */
export type StartQuizResponse = {
  attempt: QuizAttemptPublic | null;
  entry: QuizEntrySummary;
};

/**
 * Chaque échec attendu a sa propre valeur, car la page réagit différemment :
 * redirection pour `unauthorized`, message « introuvable » pour `not_found`,
 * bouton « réessayer » pour `unavailable`. Un booléen ne suffirait pas, et
 * TypeScript force à traiter tous les cas.
 */
export type StartQuizResult = StartQuizResponse | 'unauthorized' | 'not_found' | 'unavailable';

/**
 * Démarre l'épreuve — ou reprend celle déjà en cours, sans rien régénérer.
 *
 * Le 503 correspond au refus délibéré du serveur : si le modèle renvoie un JSON
 * invalide, il préfère ne rien créer plutôt que d'enregistrer un QCM douteux.
 * Réessayer plus tard est donc la bonne réaction.
 */
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

  if (response.status === 503) {
    return 'unavailable';
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

/** Récapitulatif d'après-correction : c'est seulement ici qu'apparaît `correctIndex`. */
export type QuizQuestionRecap = {
  id: string;
  prompt: string;
  choices: string[];
  selectedIndex: number;
  correctIndex: number;
  selectedChoice: string;
  correctChoice: string;
};

export type SubmitQuizResponse = {
  id: string;
  score: number;
  correctCount: number;
  total: number;
  questions: QuizQuestionRecap[];
  entry: QuizEntrySummary;
};
export type SubmitQuizResult = SubmitQuizResponse | 'unauthorized' | 'not_found' | 'bad_request';

/**
 * Envoie les réponses et reçoit le score corrigé.
 *
 * Le 400 (`bad_request`) signale des réponses incohérentes avec la tentative :
 * question inconnue, doublon ou nombre de réponses incorrect. Le serveur vérifie
 * cette correspondance car les identifiants de questions transitent par le
 * navigateur et pourraient être modifiés.
 */
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
