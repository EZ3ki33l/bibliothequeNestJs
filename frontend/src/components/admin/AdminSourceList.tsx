import { Button, Checkbox, Input, Label, TextField } from '@heroui/react';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { todayAsDay } from '../../lib/entrySources';
import { emptySourceRow, MAX_SOURCES, type SourceRow } from './sourceRows';

type AdminSourceListProps = {
  rows: SourceRow[];
  onChange: (rows: SourceRow[]) => void;
};

/**
 * Saisie des sources d'une fiche, ligne par ligne, sans balisage.
 *
 * Même principe qu'`AdminKeyValueList` pour les fichiers : la liste est un
 * état React tenu par le formulaire (elle ne peut pas venir de `FormData`), et
 * ce composant ne fait que l'afficher et proposer la liste suivante par
 * `onChange`. Aucune validation ici : elle vit dans `rowsToSources`, appelée à
 * l'aperçu et à l'enregistrement.
 *
 * L'ordre des lignes est l'ordre d'affichage sur la fiche. Boutons ↑ / ↓
 * plutôt qu'un glisser-déposer : utilisables au clavier et au lecteur d'écran.
 */
export function AdminSourceList({ rows, onChange }: AdminSourceListProps) {
  const today = todayAsDay();

  function updateRow(id: string, patch: Partial<Omit<SourceRow, 'id'>>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function moveRow(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) {
      return;
    }

    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Sources</p>
          <p className="text-muted mt-0.5 text-xs">
            Documents d’origine, affichés au bas de la fiche dans cet ordre. Les liens commencent
            par https://.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isDisabled={rows.length >= MAX_SOURCES}
          onPress={() => onChange([...rows, emptySourceRow()])}
        >
          <PlusIcon className="size-4" />
          Ajouter une source
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted text-sm">
          Aucune source. Le bloc « Sources » n’apparaîtra pas sur la fiche.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const label = `la source ${index + 1}`;

            return (
              <li key={row.id} className="border-border flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted text-xs">Source {index + 1}</p>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      aria-label={`Monter ${label}`}
                      isDisabled={index === 0}
                      onPress={() => moveRow(index, -1)}
                    >
                      <ArrowUpIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      aria-label={`Descendre ${label}`}
                      isDisabled={index === rows.length - 1}
                      onPress={() => moveRow(index, 1)}
                    >
                      <ArrowDownIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="danger-soft"
                      size="sm"
                      isIconOnly
                      aria-label={`Supprimer ${label}`}
                      onPress={() => onChange(rows.filter((item) => item.id !== row.id))}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                </div>

                <TextField
                  value={row.title}
                  onChange={(title) => updateRow(row.id, { title })}
                  maxLength={200}
                  autoComplete="off"
                >
                  <Label>Titre du document</Label>
                  <Input placeholder="useState" />
                </TextField>
                <TextField
                  value={row.url}
                  onChange={(url) => updateRow(row.id, { url })}
                  maxLength={2048}
                  autoComplete="off"
                >
                  <Label>Lien</Label>
                  <Input placeholder="https://react.dev/reference/react/useState" />
                </TextField>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <TextField
                    className="w-full sm:min-w-0 sm:flex-1"
                    value={row.publisher}
                    onChange={(publisher) => updateRow(row.id, { publisher })}
                    maxLength={120}
                    autoComplete="off"
                  >
                    <Label>Éditeur (optionnel)</Label>
                    <Input placeholder="react.dev" />
                  </TextField>
                  <TextField
                    className="w-full sm:w-44 sm:shrink-0"
                    type="date"
                    value={row.consultedOn}
                    onChange={(consultedOn) => updateRow(row.id, { consultedOn })}
                  >
                    <Label>Consultée le (optionnel)</Label>
                    <Input max={today} />
                  </TextField>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <TextField
                    className="w-full sm:w-44 sm:shrink-0"
                    value={row.licenseName}
                    onChange={(licenseName) => updateRow(row.id, { licenseName })}
                    maxLength={80}
                    autoComplete="off"
                  >
                    <Label>Licence (optionnel)</Label>
                    <Input placeholder="CC BY 4.0" />
                  </TextField>
                  <TextField
                    className="w-full sm:min-w-0 sm:flex-1"
                    value={row.licenseUrl}
                    onChange={(licenseUrl) => updateRow(row.id, { licenseUrl })}
                    maxLength={2048}
                    autoComplete="off"
                  >
                    <Label>Lien de la licence (optionnel)</Label>
                    <Input placeholder="https://creativecommons.org/licenses/by/4.0/" />
                  </TextField>
                </div>

                <Checkbox
                  isSelected={row.adapted}
                  onChange={(adapted) => updateRow(row.id, { adapted })}
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label>La fiche est une adaptation de ce document (« Adapté de »)</Label>
                  </Checkbox.Content>
                </Checkbox>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
