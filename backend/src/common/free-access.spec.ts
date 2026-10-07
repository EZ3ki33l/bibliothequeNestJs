import { freeEntryIds, type AccessPath } from './free-access';

function path(...modules: string[][]): AccessPath {
  return {
    modules: modules.map((entryIds) => ({ steps: entryIds.map((entryId) => ({ entryId })) })),
  };
}

function sorted(ids: Set<string>): string[] {
  return [...ids].sort();
}

describe('freeEntryIds', () => {
  it('opens the steps of the first module only', () => {
    const demo = path(['e1', 'e2', 'e3'], ['e4', 'e5', 'e6', 'e7']);

    expect(sorted(freeEntryIds([demo]))).toEqual(['e1', 'e2', 'e3']);
  });

  it('skips a first module without visible step : the second one is the first shown', () => {
    expect(sorted(freeEntryIds([path([], ['e4', 'e5'], ['e6'])]))).toEqual(['e4', 'e5']);
  });

  it('opens nothing for a path without module', () => {
    expect(freeEntryIds([path()]).size).toBe(0);
  });

  it('opens nothing for a path whose modules are all empty', () => {
    expect(freeEntryIds([path([], [])]).size).toBe(0);
  });

  it('opens nothing without any path', () => {
    expect(freeEntryIds([]).size).toBe(0);
  });

  it('unions the first modules of every path', () => {
    const react = path(['e1', 'e2'], ['e3']);
    const css = path(['e8'], ['e9']);

    expect(sorted(freeEntryIds([react, css]))).toEqual(['e1', 'e2', 'e8']);
  });

  it('keeps an entry free when it opens one path and comes later in another', () => {
    const first = path(['shared'], ['e2']);
    const later = path(['e3'], ['shared']);

    expect(freeEntryIds([first, later]).has('shared')).toBe(true);
    expect(freeEntryIds([later, first]).has('shared')).toBe(true);
  });

  it('leaves an entry reserved when it only comes after the first module', () => {
    expect(freeEntryIds([path(['e1'], ['later'])]).has('later')).toBe(false);
  });

  it('counts an entry once, even when two paths open with it', () => {
    expect(freeEntryIds([path(['e1']), path(['e1'])]).size).toBe(1);
  });
});
