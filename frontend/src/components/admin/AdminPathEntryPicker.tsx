import { useEffect, useState } from 'react';
import { Button, Chip, Input, Label, TextField } from '@heroui/react';
import { listAdminEntries, type AdminEntryListItem } from '../../lib/admin';

type AdminPathEntryPickerProps = {
  /** Fiches déjà présentes dans le parcours : affichées mais non sélectionnables. */
  excludedEntryIds: ReadonlySet<string>;
  isDisabled?: boolean;
  onPick: (entry: AdminEntryListItem) => void;
};

/** Délai avant d'interroger l'API : on attend que la frappe se calme. */
const SEARCH_DELAY_MS = 300;
const RESULT_LIMIT = 10;

/**
 * Choix d'une fiche par son titre, pour l'ajouter à un module.
 *
 * Chaque résultat montre son stack, sa catégorie et son état : un parcours
 * mélange des fiches de plusieurs stacks, et une fiche brouillon peut y être
 * ajoutée (elle restera masquée côté public tant qu'elle n'est pas publiée).
 * Aucun identifiant technique n'est demandé.
 */
export function AdminPathEntryPicker({
  excludedEntryIds,
  isDisabled = false,
  onPick,
}: AdminPathEntryPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminEntryListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = query.trim();

  useEffect(() => {
    if (search === '') return;

    // Même garde que `useAsyncData` : une réponse lente d'une frappe
    // précédente ne doit pas écraser celle de la frappe actuelle.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      listAdminEntries(1, RESULT_LIMIT, search)
        .then((page) => {
          if (cancelled) return;
          setResults(page.items);
          setError(null);
        })
        .catch(() => {
          if (!cancelled) setError('Impossible de rechercher les fiches');
        });
    }, SEARCH_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="flex flex-col gap-2">
      <TextField value={query} onChange={setQuery} isDisabled={isDisabled} autoComplete="off">
        <Label>Ajouter une fiche</Label>
        <Input placeholder="Rechercher par titre…" />
      </TextField>

      {error ? <p className="text-danger text-xs">{error}</p> : null}

      {search !== '' && results !== null ? (
        results.length === 0 ? (
          <p className="text-muted text-xs">Aucune fiche ne correspond.</p>
        ) : (
          <ul className="border-border flex flex-col rounded-xl border">
            {results.map((entry) => {
              const alreadyIn = excludedEntryIds.has(entry.id);

              return (
                <li
                  key={entry.id}
                  className="border-border flex items-center gap-3 border-b p-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{entry.title}</p>
                    <p className="text-muted text-xs">
                      {entry.category.stack.name} › {entry.category.name}
                    </p>
                  </div>
                  {entry.published ? null : (
                    <Chip size="sm" variant="soft" color="warning">
                      Brouillon
                    </Chip>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    isDisabled={isDisabled || alreadyIn}
                    onPress={() => {
                      onPick(entry);
                      setQuery('');
                      setResults(null);
                    }}
                  >
                    {alreadyIn ? 'Déjà dans le parcours' : 'Ajouter'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
