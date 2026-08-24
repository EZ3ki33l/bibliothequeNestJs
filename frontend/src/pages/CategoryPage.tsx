import { Link, useParams } from 'react-router';
import { getCategoryBySlugs, type CategoryDetail } from '../lib/stacks';
import { useEffect, useState } from 'react';

const KIND_LABEL: Record<CategoryDetail['entries'][number]['kind'], string> = {
  FUNCTION: 'Fonction',
  COMPONENT: 'Composant',
  CONCEPT: 'Concept',
};

const DIFFICULTY_LABEL: Record<CategoryDetail['entries'][number]['difficulty'], string> = {
  BEGINNER: 'Débutant',
  INTERMEDIATE: 'Intermédiaire',
  ADVANCED: 'Avancé',
};

export function CategoryPage() {
  const { stackSlug, categorySlug } = useParams();
  const [category, setCategory] = useState<CategoryDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stackSlug || !categorySlug) return;
    let cancelled = false;

    getCategoryBySlugs(stackSlug, categorySlug)
      .then((data) => {
        if (!cancelled) setCategory(data);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger la catégorie');
      });

    return () => {
      cancelled = true;
    };
  }, [stackSlug, categorySlug]);

  if (error) return <p>{error}</p>;
  if (category === undefined) return <p>Chargement…</p>;
  if (category === null) return <p>Catégorie introuvable.</p>;

  return (
    <main>
      <p>
        <Link to="/stacks">Stacks</Link>
        {' / '}
        <Link to={`/stacks/${category.stack.slug}`}>{category.stack.name}</Link>
        {' / '}
        {category.name}
      </p>
      <h1>{category.name}</h1>
      {category.description ? <p>{category.description}</p> : null}
      {category.entries.length === 0 ? (
        <p>Aucune fiche publiée.</p>
      ) : (
        <ul>
          {category.entries.map((entry) => (
            <li key={entry.id}>
              <p>
                <Link to={`/entries/${entry.slug}`}>{entry.title}</Link>
              </p>
              {entry.summary ? <p>{entry.summary}</p> : null}
              <p>
                {KIND_LABEL[entry.kind]} · {DIFFICULTY_LABEL[entry.difficulty]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
