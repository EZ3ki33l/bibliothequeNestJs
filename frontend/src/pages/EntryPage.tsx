import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Skeleton } from '@heroui/react';
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
import { HeartIcon } from '../components/ui/HeartIcon';
import { addFavorite, listFavorites, removeFavorite } from '../lib/favorites';

/** À quelle fiche correspond le dernier état de favori chargé depuis le serveur. */
type FavoriteState = { entryId: string; favorited: boolean };

export function EntryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [favoriteState, setFavoriteState] = useState<FavoriteState | null>(null);
  // Écriture en cours (POST ou DELETE /favorites) : désactive le bouton pour éviter un double-clic.
  const [favPending, setFavPending] = useState(false);
  // Message d'échec du dernier marquage/retrait, distinct de `error` (qui concerne toute la fiche).
  const [favError, setFavError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const { data: entry, error } = useAsyncData(
    () => (slug ? getEntryBySlug(slug) : Promise.resolve(null)),
    [slug],
    'Impossible de charger la fiche',
  );

  /**
   * `undefined` tant que le résultat affiché ne correspond pas à la fiche
   * actuellement ouverte (pas de session, ou requête pas encore revenue).
   *
   * Le calcul est fait ici, à l'affichage, plutôt que remis à zéro dans
   * l'effet ci-dessous : `favoriteState` peut légitimement contenir l'état
   * d'une fiche précédente pendant qu'on charge la nouvelle (l'utilisateur a
   * changé de page avant la réponse), et comparer `entryId` à chaque rendu
   * évite d'afficher ce résultat périmé. Même principe que `useAsyncData`
   * (voir son commentaire sur `state.key === key`).
   */
  const favorited =
    userId && entry?.id && favoriteState?.entryId === entry.id
      ? favoriteState.favorited
      : undefined;

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

  useEffect(() => {
    if (!entry?.id || !userId) return;

    const currentEntryId = entry.id;
    let cancelled = false;

    listFavorites({ entryId: currentEntryId, limit: 1 })
      .then((result) => {
        if (cancelled) return;
        setFavoriteState({
          entryId: currentEntryId,
          favorited: result !== 'unauthorized' && result.items.length > 0,
        });
      })
      .catch(() => {
        if (!cancelled) setFavoriteState({ entryId: currentEntryId, favorited: false });
      });

    return () => {
      cancelled = true;
    };
  }, [entry?.id, userId]);

  /**
   * Bascule le favori de la fiche : ajoute si absent, retire si déjà présent.
   *
   * Deux gardes avant de partir en requête : pas de fiche chargée, ou une
   * requête déjà en cours (`favPending`) — un double clic pendant l'aller-
   * retour réseau ne doit pas déclencher deux écritures, même si le serveur
   * gère de toute façon l'idempotence des deux côtés (POST 200 si déjà
   * présent, DELETE 204 si déjà absent).
   *
   * Les deux appels renvoient `'unauthorized'` plutôt que de lever une
   * exception dans ce cas précis : la session a pu expirer entre le
   * chargement de la page et le clic. On l'affiche comme un message, sans
   * rediriger — le bouton lui-même n'est visible que si `userId` était
   * présent au rendu.
   */
  async function onToggleFavorite() {
    if (!entry?.id || favPending) return;

    const currentEntryId = entry.id;
    const wasFavorited = favorited === true;
    setFavPending(true);
    setFavError(null);

    try {
      const result = wasFavorited
        ? await removeFavorite(currentEntryId)
        : await addFavorite(currentEntryId);

      if (result === 'unauthorized') {
        if (wasFavorited) {
          navigate('/login', { replace: true });
        } else {
          setFavError('Connectez-vous pour marquer cette fiche.');
        }
        return;
      }

      setFavoriteState({ entryId: currentEntryId, favorited: !wasFavorited });
    } catch (caught) {
      setFavError(
        caught instanceof Error
          ? caught.message
          : `Impossible de ${wasFavorited ? 'retirer' : 'marquer'} cette fiche`,
      );
    } finally {
      setFavPending(false);
    }
  }

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
              <li key={tag}>
                {/* Suivre un tag ouvre la recherche déjà filtrée (US3 / FR-006).
                    `encodeURIComponent` protège un tag qui contiendrait un
                    espace ou un caractère spécial dans l'URL. */}
                <Link
                  to={`/recherche?tag=${encodeURIComponent(tag)}`}
                  className="text-muted hover:text-foreground text-xs underline"
                >
                  #{tag}
                </Link>
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
        {/*
          Le bouton n'apparaît que si `userId` est présent (visiteur : jamais
          de bouton) ET que `favorited` a fini de charger (`!== undefined`) :
          sans cette seconde condition, un connecté verrait une fraction de
          seconde le cœur à contour même si la fiche est déjà favorite, avant
          que `GET /favorites?entryId=` ne réponde.

          Cœur à contour = pas encore favori (clic → ajoute) ; cœur plein
          rouge = déjà favori (clic → retire, Phase 5). Toujours cliquable,
          seul `favPending` désactive le temps de l'aller-retour réseau.
        */}
        {userId && favorited !== undefined ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              isIconOnly
              isDisabled={favPending}
              aria-label={favorited ? 'Retirer des favoris' : 'Mettre de côté'}
              onPress={() => {
                void onToggleFavorite();
              }}
            >
              <HeartIcon
                filled={favorited}
                className={
                  favorited
                    ? 'text-danger size-5 transition-transform duration-150 hover:scale-125'
                    : 'text-muted hover:text-danger size-5 transition-transform duration-150 hover:scale-125'
                }
              />
            </Button>
            {favError ? <span className="text-danger text-xs">{favError}</span> : null}
          </div>
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
