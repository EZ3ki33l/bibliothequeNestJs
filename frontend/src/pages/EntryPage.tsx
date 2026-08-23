import { Link, useParams } from 'react-router';
import { getEntryBySlug, type EntryDetail } from '../lib/stacks';
import { useEffect, useState } from 'react';

const KIND_LABEL: Record<EntryDetail['kind'], string> = {
  FUNCTION: 'Fonction',
  COMPONENT: 'Composant',
  CONCEPT: 'Concept',
};

const DIFFICULTY_LABEL: Record<EntryDetail['difficulty'], string> = {
  BEGINNER: 'Débutant',
  INTERMEDIATE: 'Intermédiaire',
  ADVANCED: 'Avancé',
};

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

  if (error) return <p>{error}</p>;
  if (entry === undefined) return <p>Chargement ...</p>;
  if (entry === null) return <p>Fiche introuvable</p>;

  const { stack, ...category } = {
    stack: entry.category.stack,
    name: entry.category.name,
    slug: entry.category.slug,
  };

  return (
    <main>
      <p>
        <Link to="/stacks">Stacks</Link>
        {' / '}
        <Link to={`/stacks/${stack.slug}`}>{stack.name}</Link>
        {' / '}
        <Link to={`/stacks/${stack.slug}/${category.slug}`}>{category.name}</Link>
        {' / '}
        {entry.title}
      </p>
      <h1>{entry.title}</h1>
      <p>
        {KIND_LABEL[entry.kind]} · {DIFFICULTY_LABEL[entry.difficulty]}
      </p>
      {entry.summary ? <p>{entry.summary}</p> : null}
      {entry.tags.length > 0 ? <p>{entry.tags.join(', ')}</p> : null}
      {entry.bodyMdx ? <pre>{entry.bodyMdx}</pre> : null}
    </main>
  );
}
