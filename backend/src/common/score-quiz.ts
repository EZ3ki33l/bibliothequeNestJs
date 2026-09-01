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
  score: number;
  correctCount: number;
  total: number;
};

export function scoreQuiz(
  questions: ScoreQuizQuestion[],
  answers: ScoreQuizAnswer[],
): ScoreQuizResult {
  const total = questions.length;
  if (total === 0) {
    throw new Error('Cannot score an empty quiz');
  }
  const answersByQuestionId = new Map<string, ScoreQuizAnswer>();
  for (const answer of answers) {
    if (answersByQuestionId.has(answer.questionId)) {
      throw new Error('Duplicate answer');
    }
    answersByQuestionId.set(answer.questionId, answer);
  }

  if (answersByQuestionId.size !== total) {
    throw new Error('Answer do not match questions');
  }

  let correctCount = 0;
  for (const question of questions) {
    const answer = answersByQuestionId.get(question.id);
    if (!answer) {
      throw new Error('Mission answer');
    }
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
    score: Math.round((correctCount / total) * 100),
    correctCount,
    total,
  };
}
