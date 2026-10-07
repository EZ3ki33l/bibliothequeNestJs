import { lastActivity, rankStartedPaths } from './started-paths';

function at(day: number): Date {
  return new Date(Date.UTC(2026, 9, day));
}

describe('lastActivity', () => {
  it('returns null when the account did nothing on these entries', () => {
    expect(lastActivity(['e1', 'e2'], new Map())).toBeNull();
    expect(lastActivity([], new Map([['e1', at(1)]]))).toBeNull();
  });

  it('returns the most recent activity among the entries', () => {
    const activity = new Map([
      ['e1', at(2)],
      ['e2', at(5)],
      ['e3', at(3)],
    ]);

    expect(lastActivity(['e1', 'e2', 'e3'], activity)).toEqual(at(5));
  });

  it('ignores the activity of entries outside the list', () => {
    const activity = new Map([
      ['e1', at(2)],
      ['autre', at(9)],
    ]);

    expect(lastActivity(['e1'], activity)).toEqual(at(2));
  });
});

describe('rankStartedPaths', () => {
  it('sorts by last activity, most recent first', () => {
    const paths = [
      { id: 'ancien', lastActivityAt: at(1) },
      { id: 'recent', lastActivityAt: at(9) },
      { id: 'milieu', lastActivityAt: at(5) },
    ];

    expect(rankStartedPaths(paths, 3).map((path) => path.id)).toEqual([
      'recent',
      'milieu',
      'ancien',
    ]);
  });

  it('cuts at the limit', () => {
    const paths = [
      { id: 'a', lastActivityAt: at(1) },
      { id: 'b', lastActivityAt: at(2) },
      { id: 'c', lastActivityAt: at(3) },
      { id: 'd', lastActivityAt: at(4) },
    ];

    expect(rankStartedPaths(paths, 3).map((path) => path.id)).toEqual(['d', 'c', 'b']);
  });

  it('excludes a path without activity', () => {
    const paths = [
      { id: 'jamais-ouvert', lastActivityAt: null },
      { id: 'commence', lastActivityAt: at(1) },
    ];

    expect(rankStartedPaths(paths, 3).map((path) => path.id)).toEqual(['commence']);
  });

  it('keeps the received order on a tie', () => {
    const paths = [
      { id: 'premier', lastActivityAt: at(4) },
      { id: 'second', lastActivityAt: at(4) },
      { id: 'troisieme', lastActivityAt: at(4) },
    ];

    expect(rankStartedPaths(paths, 3).map((path) => path.id)).toEqual([
      'premier',
      'second',
      'troisieme',
    ]);
  });

  it('returns nothing for a limit of zero or less, and does not mutate its input', () => {
    const paths = [
      { id: 'a', lastActivityAt: at(1) },
      { id: 'b', lastActivityAt: at(2) },
    ];

    expect(rankStartedPaths(paths, 0)).toEqual([]);
    expect(rankStartedPaths(paths, -1)).toEqual([]);
    expect(paths.map((path) => path.id)).toEqual(['a', 'b']);
  });
});
