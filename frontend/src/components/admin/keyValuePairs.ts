export type KeyValuePair = {
  id: string;
  key: string;
  value: string;
};

export function emptyPair(): KeyValuePair {
  return { id: crypto.randomUUID(), key: '', value: '' };
}

export function recordToPairs(record: Record<string, string> | undefined): KeyValuePair[] {
  if (record === undefined) {
    return [];
  }
  return Object.entries(record).map(([key, value]) => ({
    id: crypto.randomUUID(),
    key,
    value,
  }));
}

export function pairsToRecord(
  pairs: KeyValuePair[],
  emptyKeyMessage = 'Chaque ligne renseignée doit avoir un nom.',
): { ok: true; value: Record<string, string> } | { ok: false; message: string } {
  const record: Record<string, string> = {};

  for (const pair of pairs) {
    const key = pair.key.trim();
    const hasContent = pair.value.trim().length > 0;
    if (key.length === 0) {
      if (hasContent) {
        return { ok: false, message: emptyKeyMessage };
      }
      continue;
    }
    if (key in record) {
      return { ok: false, message: `Le nom « ${key} » est en double.` };
    }
    record[key] = pair.value;
  }

  return { ok: true, value: record };
}
