import { useSearchParams } from 'react-router';
import { type SubmitEvent } from 'react';
import { Button, Input, Label, Skeleton, TextField } from '@heroui/react';
import { listStacks, searchEntries } from '../lib/stacks';
import { DIFFICULTY_LABEL, KIND_LABEL } from '../lib/labels';
import { MAX_SEARCH_LENGTH } from '../lib/headerSearch';
import { AdminSelect } from '../components/admin/AdminSelect';
import { useAsyncData } from '../lib/useAsyncData';
import { useEntryStates } from '../lib/useEntryStates';
import { useAccessMentions } from '../lib/entryAccess';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { EntryCard } from '../components/ui/EntryCard';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageHeader } from '../components/ui/PageHeader';

/**
 * Écran public de découverte (US1 recherche + US2 filtres + US3 tag).
 *
 * Sans compte. `q` (mots), les filtres `kind` / `difficulty` / `stack` et le
 * `tag` (suivi depuis une fiche) se combinent en ET côté serveur ; les
 * brouillons ne sortent jamais de `GET /entries`. Tant qu'AUCUN critère n'est
 * posé, on n'interroge pas l'API (état « invite à chercher »).
 *
 * Tous les critères vivent dans l'URL (pas seulement dans un state React) : un
 * tag cliqué sur une fiche ou un lien partagé rouvre exactement la même
 * recherche.
 */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';
  const kind = searchParams.get('kind') ?? '';
  const difficulty = searchParams.get('difficulty') ?? '';
  const stack = searchParams.get('stack') ?? '';
  const tag = searchParams.get('tag')?.trim() ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  // US2/US3 : filtrer (ou suivre un tag) sans taper de mot est valide.
  const hasCriteria = q !== '' || kind !== '' || difficulty !== '' || stack !== '' || tag !== '';

  // Les stacks alimentent le select « Leçons ». Chargés une fois.
  const { data: stacks } = useAsyncData(() => listStacks(), [], 'Impossible de charger les leçons');

  const { data, error } = useAsyncData(
    () =>
      hasCriteria
        ? searchEntries({ q, kind, difficulty, stack, tag, page })
        : Promise.resolve(null),
    [q, kind, difficulty, stack, tag, page],
    'Impossible de charger les fiches',
  );

  // Repères du compte connecté pour la page de résultats affichée.
  const entryIds = data?.items.map((entry) => entry.id) ?? [];
  const states = useEntryStates(entryIds);
  // Mention des fiches réservées. La recherche porte sur le titre, le résumé et
  // les étiquettes, qui sont publics : toutes les fiches publiées y figurent.
  const accessOf = useAccessMentions(entryIds);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    const nextQ = String(form.get('q') ?? '').trim();
    const nextKind = String(form.get('kind') ?? '');
    const nextDifficulty = String(form.get('difficulty') ?? '');
    const nextStack = String(form.get('stack') ?? '');
    // Valeur '' = « Tous » : on ne l'écrit pas dans l'URL.
    if (nextQ) next.set('q', nextQ);
    if (nextKind) next.set('kind', nextKind);
    if (nextDifficulty) next.set('difficulty', nextDifficulty);
    if (nextStack) next.set('stack', nextStack);
    // Le tag vient de l'URL (pas du formulaire) : on le reconduit tant que
    // l'utilisateur ne l'a pas retiré via la puce.
    if (tag) next.set('tag', tag);
    // Toute nouvelle recherche repart de la page 1 (next sans `page`).
    setSearchParams(next);
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  }

  function clearTag() {
    const next = new URLSearchParams(searchParams);
    next.delete('tag');
    next.delete('page');
    setSearchParams(next);
  }

  const kindItems = [
    { id: '', label: 'Tous les formats' },
    ...Object.entries(KIND_LABEL).map(([id, label]) => ({ id, label })),
  ];
  const difficultyItems = [
    { id: '', label: 'Tous les niveaux' },
    ...Object.entries(DIFFICULTY_LABEL).map(([id, label]) => ({ id, label })),
  ];
  const stackItems = [
    { id: '', label: 'Toutes les leçons' },
    ...(stacks ?? []).map((s) => ({ id: s.slug, label: s.name })),
  ];

  return (
    <>
      <PageHeader
        title="Recherche"
        description="Recherche de fiches publiées par mots (titre, résumé, étiquette), niveau, format ou leçon. La recherche se fait sans compte."
      />

      <form onSubmit={onSubmit} className="mb-8 flex flex-wrap items-end gap-3">
        <TextField
          name="q"
          className="w-full sm:w-auto sm:min-w-64 sm:flex-1"
          defaultValue={q}
          key={q}
          maxLength={MAX_SEARCH_LENGTH}
        >
          <Label>Mots</Label>
          <Input placeholder="ex. useState, hooks…" />
        </TextField>
        {/* `key` force le select à reprendre la valeur de l'URL après navigation. */}
        <AdminSelect
          key={`kind-${kind}`}
          name="kind"
          label="Format"
          items={kindItems}
          defaultValue={kind}
        />
        <AdminSelect
          key={`difficulty-${difficulty}`}
          name="difficulty"
          label="Niveau"
          items={difficultyItems}
          defaultValue={difficulty}
        />
        <AdminSelect
          key={`stack-${stack}`}
          name="stack"
          label="Leçon"
          items={stackItems}
          defaultValue={stack}
        />
        <Button type="submit" variant="primary">
          Chercher
        </Button>
      </form>

      {tag ? (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <span className="text-muted">Tag actif :</span>
          <Button type="button" variant="ghost" size="sm" onPress={clearTag}>
            #{tag} ✕
          </Button>
        </div>
      ) : null}

      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : data === undefined ? (
        <div className="card-grid grid gap-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : data === null ? (
        <EmptyMessage>Un mot ou un filtre lance la recherche.</EmptyMessage>
      ) : data.items.length === 0 ? (
        <EmptyMessage>Aucune fiche publiée ne correspond à ces critères.</EmptyMessage>
      ) : (
        <>
          <ul className="card-grid grid gap-4">
            {data.items.map((entry) => (
              <li key={entry.id}>
                <EntryCard
                  entry={entry}
                  state={states?.byEntryId.get(entry.id)}
                  access={accessOf(entry.id)}
                />
              </li>
            ))}
          </ul>
          {data.total > data.limit ? (
            <div className="text-muted mt-6 flex items-center gap-3 text-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={page <= 1}
                onPress={() => goToPage(page - 1)}
              >
                Précédent
              </Button>
              <span>
                Page {page} · {data.total} au total
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={page * data.limit >= data.total}
                onPress={() => goToPage(page + 1)}
              >
                Suivant
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
