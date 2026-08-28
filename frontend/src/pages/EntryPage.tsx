import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Chip, Skeleton } from '@heroui/react';
import { getEntryBySlug, jsonToStringRecord, type EntryDetail } from '../lib/stacks';
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL, KIND_LABEL } from '../lib/labels';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { EntryMdx } from '../components/entry/EntryMdx';
import { Playground } from '../components/lab/Playground';

export function EntryPage() {
  const { slug } = useParams();
  const [entry, setEntry] = useState<EntryDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    getEntryBySlug(slug)
      .then((data) => {
        if (!cancelled) setEntry(data);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger la fiche');
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (entry === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-3/4 rounded-lg" />
        <Skeleton className="h-5 w-1/2 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (entry === null) {
    return <EmptyMessage>Fiche introuvable.</EmptyMessage>;
  }

  const { category } = entry;
  const { stack } = category;
  const files = jsonToStringRecord(entry.files);
  const dependencies = jsonToStringRecord(entry.dependencies);
  const showPlayground = entry.kind !== 'CONCEPT' && files;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Breadcrumbs
        items={[
          { label: 'Stacks', to: '/stacks' },
          { label: stack.name, to: `/stacks/${stack.slug}` },
          { label: category.name, to: `/stacks/${stack.slug}/${category.slug}` },
          { label: entry.title },
        ]}
      />

      <header className="border-border mb-8 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{entry.title}</h1>

        {entry.summary ? <p className="text-muted mt-3 text-base">{entry.summary}</p> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Chip size="sm" variant="soft">
            {KIND_LABEL[entry.kind]}
          </Chip>
          <Chip size="sm" variant="soft" color={DIFFICULTY_COLOR[entry.difficulty]}>
            {DIFFICULTY_LABEL[entry.difficulty]}
          </Chip>
        </div>

        {entry.tags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {entry.tags.map((tag) => (
              <li key={tag} className="text-muted text-xs">
                #{tag}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {entry.bodyMdx ? (
        <EntryMdx source={entry.bodyMdx} />
      ) : (
        <EmptyMessage>Cette fiche n’a pas encore de contenu.</EmptyMessage>
      )}
      {showPlayground ? (
        <Playground files={files} template={entry.template} dependencies={dependencies} />
      ) : null}
    </article>
  );
}
