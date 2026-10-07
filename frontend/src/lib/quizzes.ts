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
 * Plafond d'examens atteint (429) : le compte en a démarré trop dans l'heure.
 * `retryAt` est l'instant du prochain essai possible, `null` si le serveur ne
 * l'a pas donné (le 429 peut aussi venir du plafond général de l'API).
 */
export type QuizLimited = { limited: true; retryAt: string | null };

/**
 * Chaque échec attendu a sa propre valeur, car la page réagit différemment :
 * redirection pour `unauthorized`, message « introuvable » pour `not_found`,
 * bouton « réessayer » pour `unavailable`, heure du prochain essai pour le
 * plafond, explication pour `forbidden` (403 : la fiche est réservée et
 * l'adresse du compte n'est pas vérifiée ; un examen révélerait son contenu).
 * Un booléen ne suffirait pas, et TypeScript force à traiter tous les cas.
 */
export type StartQuizResult =
  StartQuizResponse | QuizLimited | 'unauthorized' | 'forbidden' | 'not_found' | 'unavailable';

/** Lit `retryAt` dans le corps d'un 429, sans faire confiance à sa forme. */
async function readRetryAt(response: Response): Promise<string | null> {
  const body: unknown = await response.json().catch(() => null);

  if (typeof body === 'object' && body !== null && 'retryAt' in body) {
    const { retryAt } = body as { retryAt: unknown };
    return typeof retryAt === 'string' ? retryAt : null;
  }

  return null;
}

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

  if (response.status === 403) {
    return 'forbidden';
  }

  if (response.status === 404) {
    return 'not_found';
  }

  if (response.status === 503) {
    return 'unavailable';
  }

  if (response.status === 429) {
    return { limited: true, retryAt: await readRetryAt(response) };
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
  /**
   * Verdict et seuil, décidés par le serveur : c'est le seuil qui valide une
   * étape de parcours. Le navigateur ne le recopie pas, il ne peut donc pas
   * annoncer « réussi » pour un examen qui ne valide rien.
   */
  passed: boolean;
  passingScore: number;
  correctCount: number;
  total: number;
  questions: QuizQuestionRecap[];
  entry: QuizEntrySummary;
};
export type SubmitQuizResult =
  SubmitQuizResponse | 'unauthorized' | 'forbidden' | 'not_found' | 'bad_request';

/**
 * Envoie les réponses et reçoit le score corrigé.
 *
 * Le 400 (`bad_request`) signale des réponses incohérentes avec la tentative :
 * question inconnue, doublon ou nombre de réponses incorrect. Le serveur vérifie
 * cette correspondance car les identifiants de questions transitent par le
 * navigateur et pourraient être modifiés.
 *
 * Le 403 (`forbidden`) : la fiche a été refermée depuis le démarrage et
 * l'adresse du compte n'est pas vérifiée. Le corrigé ne sort pas.
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

  if (response.status === 403) {
    return 'forbidden';
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
