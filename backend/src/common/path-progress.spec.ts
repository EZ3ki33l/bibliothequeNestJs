import { computePathProgress, type ProgressModule } from './path-progress';

const modules: ProgressModule[] = [
  {
    id: 'm1',
    steps: [
      { id: 's1', entryId: 'e1', optional: false },
      { id: 's2', entryId: 'e2', optional: false },
    ],
  },
  {
    id: 'm2',
    steps: [
      { id: 's3', entryId: 'e3', optional: false },
      { id: 's4', entryId: 'e4', optional: true },
    ],
  },
];

describe('computePathProgress', () => {
  it('starts at zero with the first required step as next', () => {
    const progress = computePathProgress(modules, new Set());

    expect(progress).toEqual({
      validatedStepIds: [],
      required: 3,
      validatedRequired: 0,
      modules: [
        { moduleId: 'm1', required: 2, validatedRequired: 0 },
        { moduleId: 'm2', required: 1, validatedRequired: 0 },
      ],
      nextStepId: 's1',
      completed: false,
    });
  });

  it('suggests the first gap in order, even when later steps are validated', () => {
    const progress = computePathProgress(modules, new Set(['e1', 'e3']));

    expect(progress.nextStepId).toBe('s2');
    expect(progress.validatedRequired).toBe(2);
    expect(progress.modules).toEqual([
      { moduleId: 'm1', required: 2, validatedRequired: 1 },
      { moduleId: 'm2', required: 1, validatedRequired: 1 },
    ]);
  });

  it('lists validated optional steps without counting them', () => {
    const progress = computePathProgress(modules, new Set(['e4']));

    expect(progress.validatedStepIds).toEqual(['s4']);
    expect(progress.required).toBe(3);
    expect(progress.validatedRequired).toBe(0);
    expect(progress.nextStepId).toBe('s1');
  });

  it('is completed when every required step is validated, optional ones aside', () => {
    const progress = computePathProgress(modules, new Set(['e1', 'e2', 'e3']));

    expect(progress.completed).toBe(true);
    expect(progress.nextStepId).toBeNull();
    expect(progress.validatedStepIds).toEqual(['s1', 's2', 's3']);
  });

  it('is never completed without any required step', () => {
    const onlyOptional: ProgressModule[] = [
      { id: 'm1', steps: [{ id: 's1', entryId: 'e1', optional: true }] },
    ];

    const progress = computePathProgress(onlyOptional, new Set(['e1']));

    expect(progress.required).toBe(0);
    expect(progress.completed).toBe(false);
    expect(progress.nextStepId).toBeNull();
    expect(progress.validatedStepIds).toEqual(['s1']);
  });

  it('handles a path without modules', () => {
    expect(computePathProgress([], new Set(['e1']))).toEqual({
      validatedStepIds: [],
      required: 0,
      validatedRequired: 0,
      modules: [],
      nextStepId: null,
      completed: false,
    });
  });
});
