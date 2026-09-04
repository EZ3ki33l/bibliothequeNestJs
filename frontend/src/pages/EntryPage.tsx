import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { Skeleton } from '@heroui/react';
import { getEntryBySlug, jsonToStringRecord } from '../lib/stacks';
import { useAsyncData } from '../lib/useAsyncData';
import { authClient } from '../lib/auth';
import { ensureReview } from '../lib/reviews';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { EntryMeta } from '../components/ui/EntryMeta';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { EntryMdx } from '../components/entry/EntryMdx';
import { Playground } from '../components/lab/Playground';

export function EntryPage() {
  const { slug } = useParams();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const { data: entry, error } = useAsyncData(
    () => (slug ? getEntryBySlug(slug) : Promise.resolve(null)),
    [slug],
    'Impossible de charger la fiche',
  );

  /**
   * Ouvrir une fiche l'inscrit au programme de révision.
   *
   * Uniquement si l'utilisateur est connecté (une carte appartient à un
   * compte). L'appel est volontairement « silencieux » : lire une fiche doit
   * fonctionner même si l'enregistrement échoue, donc l'erreur est ignorée
   * plutôt qu'affichée.
   */
  useEffect(() => {
    if (!entry?.id || !userId) return;

    void ensureReview(entry.id).catch(() => undefined);
  }, [entry?.id, userId]);

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

  // Colonnes JSON de Prisma : validées avant d'être passées à Sandpack.
  const files = jsonToStringRecord(entry.files);
  const dependencies = jsonToStringRecord(entry.dependencies);

  // Un concept s'explique, il ne s'exécute pas : pas de playground pour lui,
  // ni pour une fiche sans fichier.
  const showPlayground = entry.kind !== 'CONCEPT' && files !== undefined;

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
          <EntryMeta kind={entry.kind} difficulty={entry.difficulty} />
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
        {/* L'examen demande une session : le lien n'apparaît que si connecté. */}
        {userId ? (
          <p className="mt-4">
            <Link to={`/entries/${entry.slug}/exam`} className="text-sm underline">
              Examen
            </Link>
          </p>
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
