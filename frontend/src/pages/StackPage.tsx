import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getStackBySlug, type StackDetail } from '../lib/stacks';

const KIND_LABEL: Record<StackDetail['categories'][number]['entries'][number]['kind'], string> = {
  FUNCTION: 'Fonction',
  COMPONENT: 'Composant',
  CONCEPT: 'Concept',
};

const DIFFICULTY_LABEL: Record<
  StackDetail['categories'][number]['entries'][number]['difficulty'],
  string
> = {
  BEGINNER: 'Débutant',
  INTERMEDIATE: 'Intermédiaire',
  ADVANCED: 'Avancé',
};

export function StackPage() {
  const { slug } = useParams();
  const [stack, setStack] = useState<StackDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    getStackBySlug(slug)
      .then((data) => {
        if (!cancelled) setStack(data);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le stack');
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) return <p>{error}</p>;
  if (stack === undefined) return <p>Chargement…</p>;
  if (stack === null) return <p>Stack introuvable.</p>;

  return (
    <main>
      <p>
        <Link to="/stacks">Stacks</Link>
        {' / '}
        {stack.name}
      </p>
      <h1>{stack.name}</h1>
      {stack.description ? <p>{stack.description}</p> : null}

      {stack.categories.length === 0 ? (
        <p>Aucune catégorie dans ce stack.</p>
      ) : (
        stack.categories.map((category) => (
          <section key={category.id}>
            <h2>{category.name}</h2>
            {category.description ? <p>{category.description}</p> : null}

            {category.entries.length === 0 ? (
              <p>Aucune fiche publiée.</p>
            ) : (
              <ul>
                {category.entries.map((entry) => (
                  <li key={entry.id}>
                    <p>{entry.title}</p>
                    {entry.summary ? <p>{entry.summary}</p> : null}
                    <p>
                      {KIND_LABEL[entry.kind]} · {DIFFICULTY_LABEL[entry.difficulty]}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </main>
  );
}
