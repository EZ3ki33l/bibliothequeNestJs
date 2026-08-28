import { Button, Input, Label, TextArea, TextField } from '@heroui/react';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { emptyPair, type KeyValuePair } from './keyValuePairs';

type AdminKeyValueListProps = {
  title: string;
  description: string;
  addLabel: string;
  emptyLabel: string;
  keyLabel: string;
  keyPlaceholder: string;
  valueLabel: string;
  valuePlaceholder?: string;
  valueRows?: number;
  compact?: boolean;
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
};

export function AdminKeyValueList({
  title,
  description,
  addLabel,
  emptyLabel,
  keyLabel,
  keyPlaceholder,
  valueLabel,
  valuePlaceholder,
  valueRows = 8,
  compact = false,
  pairs,
  onChange,
}: AdminKeyValueListProps) {
  function updatePair(id: string, patch: Partial<Pick<KeyValuePair, 'key' | 'value'>>) {
    onChange(pairs.map((pair) => (pair.id === id ? { ...pair, ...patch } : pair)));
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted mt-0.5 text-xs">{description}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onPress={() => onChange([...pairs, emptyPair()])}
        >
          <PlusIcon className="size-4" />
          {addLabel}
        </Button>
      </div>

      {pairs.length === 0 ? (
        <p className="text-muted text-sm">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pairs.map((pair) => (
            <li key={pair.id} className="border-border flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <TextField
                  className="min-w-0 flex-1"
                  value={pair.key}
                  onChange={(value) => updatePair(pair.id, { key: value })}
                  autoComplete="off"
                >
                  <Label>{keyLabel}</Label>
                  <Input placeholder={keyPlaceholder} />
                </TextField>
                {compact ? (
                  <TextField
                    className="w-36 shrink-0"
                    value={pair.value}
                    onChange={(value) => updatePair(pair.id, { value })}
                    autoComplete="off"
                  >
                    <Label>{valueLabel}</Label>
                    <Input placeholder={valuePlaceholder} />
                  </TextField>
                ) : null}
                <Button
                  type="button"
                  variant="danger-soft"
                  size="sm"
                  isIconOnly
                  aria-label="Supprimer"
                  className="mt-6"
                  onPress={() => onChange(pairs.filter((item) => item.id !== pair.id))}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
              {compact ? null : (
                <TextField value={pair.value} onChange={(value) => updatePair(pair.id, { value })}>
                  <Label>{valueLabel}</Label>
                  <TextArea
                    rows={valueRows}
                    placeholder={valuePlaceholder}
                    className="font-mono text-sm"
                  />
                </TextField>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
