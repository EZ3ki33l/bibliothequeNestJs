import { isQuizEligible, MIN_QUIZ_BODY_LENGTH } from './quiz-eligibility';

describe('isQuizEligible', () => {
  it('accepts a body of exactly the minimum length', () => {
    expect(isQuizEligible('x'.repeat(MIN_QUIZ_BODY_LENGTH))).toBe(true);
  });

  it('rejects a body one character short', () => {
    expect(isQuizEligible('x'.repeat(MIN_QUIZ_BODY_LENGTH - 1))).toBe(false);
  });

  it('ignores surrounding whitespace', () => {
    const padded = `  \n${'x'.repeat(MIN_QUIZ_BODY_LENGTH - 1)}\n  `;
    expect(isQuizEligible(padded)).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(isQuizEligible('')).toBe(false);
  });
});
