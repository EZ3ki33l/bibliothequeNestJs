export type ScoreQuizQuestion = {
  id: string;
  choices: string[];
  correctIndex: number;
};

export type ScoreQuizAnswer = {
  questionId: string;
  choiceIndex: number;
};

export type ScoreQuizResult = {
  /** Note sur 100, arrondie. */
  score: number;
  correctCount: number;
  total: number;
};

/**
 * Corrige un QCM : combien de bonnes réponses, et la note sur 100.
 *
 * Fonction **pure** : mêmes entrées, même sortie, aucun accès à la base ni à
 * l'heure courante. C'est ce qui permet de la tester directement, sans monter
 * de module Nest ni simuler Prisma.
 *
 * Les `throw new Error` marquent des situations qui ne devraient pas arriver :
 * le contrôleur a déjà validé le format des réponses, et le service a déjà
 * vérifié qu'elles correspondent aux questions enregistrées. Si l'un de ces
 * invariants est faux, mieux vaut échouer bruyamment (500) que produire un
 * score silencieusement faux. Les erreurs de *saisie*, elles, sont attrapées en
 * amont et renvoient un 400.
 */
export function scoreQuiz(
  questions: ScoreQuizQuestion[],
  answers: ScoreQuizAnswer[],
): ScoreQuizResult {
  const total = questions.length;

  if (total === 0) {
    // Éviterait surtout une division par zéro plus bas.
    throw new Error('Cannot score an empty quiz');
  }

  // Index par identifiant : sans lui, retrouver la réponse de chaque question
  // demanderait de reparcourir tout le tableau à chaque fois.
  const answersByQuestionId = new Map<string, ScoreQuizAnswer>();

  for (const answer of answers) {
    if (answersByQuestionId.has(answer.questionId)) {
      // Deux réponses pour une même question : laquelle compterait ?
      throw new Error('Duplicate answer');
    }
    answersByQuestionId.set(answer.questionId, answer);
  }

  if (answersByQuestionId.size !== total) {
    throw new Error('Answers do not match questions');
  }

  let correctCount = 0;

  for (const question of questions) {
    const answer = answersByQuestionId.get(question.id);

    if (!answer) {
      throw new Error('Missing answer');
    }

    // Un index hors bornes indiquerait une réponse fabriquée à la main.
    if (
      !Number.isInteger(answer.choiceIndex) ||
      answer.choiceIndex < 0 ||
      answer.choiceIndex >= question.choices.length
    ) {
      throw new Error('Choice index out of bounds');
    }

    if (answer.choiceIndex === question.correctIndex) {
      correctCount += 1;
    }
  }

  return {
    // 1 bonne réponse sur 3 → 33 ; 2 sur 3 → 67.
    score: Math.round((correctCount / total) * 100),
    correctCount,
    total,
  };
}
