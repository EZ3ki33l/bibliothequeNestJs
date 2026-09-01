import { scoreQuiz } from './score-quiz';

const questions = [
  { id: 'q1', choices: ['a', 'b'], correctIndex: 0 },
  { id: 'q2', choices: ['a', 'b'], correctIndex: 1 },
  { id: 'q3', choices: ['a', 'b', 'c'], correctIndex: 2 },
];

describe('scoreQuiz', () => {
  it('scores 0% when every choice is wrong', () => {
    expect(
      scoreQuiz(questions, [
        { questionId: 'q1', choiceIndex: 1 },
        { questionId: 'q2', choiceIndex: 0 },
        { questionId: 'q3', choiceIndex: 0 },
      ]),
    ).toEqual({ score: 0, correctCount: 0, total: 3 });
  });

  it('scores 100% when every choice is correct', () => {
    expect(
      scoreQuiz(questions, [
        { questionId: 'q1', choiceIndex: 0 },
        { questionId: 'q2', choiceIndex: 1 },
        { questionId: 'q3', choiceIndex: 2 },
      ]),
    ).toEqual({ score: 100, correctCount: 3, total: 3 });
  });

  it('rounds 1/3 to 33', () => {
    expect(
      scoreQuiz(questions, [
        { questionId: 'q1', choiceIndex: 0 },
        { questionId: 'q2', choiceIndex: 0 },
        { questionId: 'q3', choiceIndex: 0 },
      ]),
    ).toEqual({ score: 33, correctCount: 1, total: 3 });
  });

  it('rounds 2/3 to 67', () => {
    expect(
      scoreQuiz(questions, [
        { questionId: 'q1', choiceIndex: 0 },
        { questionId: 'q2', choiceIndex: 1 },
        { questionId: 'q3', choiceIndex: 0 },
      ]),
    ).toEqual({ score: 67, correctCount: 2, total: 3 });
  });

  it('rejects a quiz with zero questions', () => {
    expect(() => scoreQuiz([], [])).toThrow();
  });

  it('rejects a choice index outside the question bounds', () => {
    expect(() =>
      scoreQuiz(questions, [
        { questionId: 'q1', choiceIndex: 0 },
        { questionId: 'q2', choiceIndex: 1 },
        { questionId: 'q3', choiceIndex: 3 },
      ]),
    ).toThrow();
  });
});
