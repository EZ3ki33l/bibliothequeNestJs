import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { Button, Skeleton, buttonVariants } from '@heroui/react';
import { getEntryBySlug, getReaderEntry, jsonToStringRecord } from '../lib/stacks';
import { resolveEntryReading } from '../lib/entryReading';
import { useReservedEntryIds } from '../lib/entryAccess';
import { useViewerAccess } from '../lib/viewerAccess';
import { examHrefFromPath, getLearningPath } from '../lib/learningPaths';
import { adjacentSteps } from '../lib/pathSteps';
import { reportHref } from '../lib/errorReport';
import { useAsyncData } from '../lib/useAsyncData';
import { authClient } from '../lib/auth';
import { markEntryRead } from '../lib/entryProgress';
import { useEntryStates } from '../lib/useEntryStates';
import { currentReturnTo, loginHref } from '../lib/returnTo';
import { useLoginRedirect } from '../lib/useLoginRedirect';
import { usePageTitle } from '../lib/pageTitle';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { NotFoundState } from '../components/ui/NotFoundState';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { EntryArticle } from '../components/entry/EntryArticle';
import { EntryStepNav } from '../components/entry/EntryStepNav';
import { ReservedContent } from '../components/entry/ReservedContent';
import { HeartIcon } from '../components/ui/HeartIcon';
import { addFavorite, listFavorites, removeFavorite } from '../lib/favorites';
import { deleteNote, listNotes, MAX_NOTE_LENGTH, saveNote } from '../lib/notes';

/** À quelle fiche correspond le dernier état de favori chargé depuis le serveur. */
type FavoriteState = { entryId: string; favorited: boolean };

/**
 * Page d'une fiche.
 *
 * Deux lectures, dans cet ordre :
 * 1. la lecture **publique** (`GET /entries/:slug`), la même pour tous : la
 *    fiche entière si elle est en accès libre, son en-tête seul si elle est
 *    réservée ;
 * 2. pour une fiche réservée ouverte par un compte, la lecture **complète**
 *    (`GET /reader/entries/:slug`), que le serveur n'accorde qu'à une adresse
 *    vérifiée.
 *
 * `resolveEntryReading` traduit ces réponses en un état d'écran. Une fiche que
 * le lecteur ne peut pas lire affiche son en-tête, une zone floutée factice et
 * un message ; rien d'autre : ni trace de lecture, ni favori, ni note, ni
 * examen, ni signalement. Ces fonctions appartiennent à une fiche lue, et la
 * compter comme lue validerait une étape de parcours sans lecture.
 *
 * La session du navigateur (`useViewerAccess`) ne choisit que le message et
 * évite des requêtes vouées au refus. Elle n'ouvre aucun contenu : c'est le
 * serveur qui transmet, ou non, le corps de la fiche.
 */
export function EntryPage() {
  const { slug } = useParams();
  const location = useLocation();
  const redirectToLogin = useLoginRedirect();
  /**
   * Slug du parcours d'où la fiche a été ouverte (`?parcours=`), pour le lien
   * de retour et les étapes voisines. Simple aide à la navigation : il n'ouvre
   * aucun droit, et ne sert qu'à relire le plan **public** de ce parcours. Un
   * slug inconnu mène à « parcours introuvable ».
   */
  const [searchParams] = useSearchParams();
  const fromPath = searchParams.get('parcours');
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [favoriteState, setFavoriteState] = useState<FavoriteState | null>(null);
  // Écriture en cours (POST ou DELETE /favorites) : désactive le bouton pour éviter un double-clic.
  const [favPending, setFavPending] = useState(false);
  // Message d'échec du dernier marquage/retrait, distinct de `error` (qui concerne toute la fiche).
  const [favError, setFavError] = useState<string | null>(null);

  /** Fiche + dernier contenu connu du serveur pour cette fiche (chargement ou dernier enregistrement). */
  const [noteState, setNoteState] = useState<{ entryId: string; content: string } | null>(null);
  // Texte en cours d'édition, distinct de noteState : peut différer tant que "Enregistrer" n'a pas été cliqué.
  const [noteDraft, setNoteDraft] = useState('');
  const [notePending, setNotePending] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);

  const userId = session?.user?.id;
  const viewer = useViewerAccess();

  // Lecture publique : sans session, identique pour tous.
  const { data: publicEntry, error } = useAsyncData(
    () => (slug ? getEntryBySlug(slug) : Promise.resolve(null)),
    [slug],
    'Impossible de charger la fiche',
  );

  /**
   * Lecture complète, seulement pour une fiche réservée ouverte par un compte.
   * Un visiteur n'émet pas cette requête (elle répondrait 401), et tant que la
   * session n'est pas connue la page attend.
   *
   * Un compte non vérifié l'émet aussi : c'est le serveur qui tranche (403),
   * pas l'état de la session dans le navigateur, qui peut dater. `viewer` est
   * dans les dépendances : une adresse tout juste vérifiée relance la lecture,
   * et la fiche s'affiche sans reconnexion.
   */
  const needsReader =
    publicEntry?.access === 'reserved' && viewer !== undefined && viewer !== 'visitor';
  const { data: readerEntry, error: readerError } = useAsyncData(
    () => (needsReader && slug ? getReaderEntry(slug) : Promise.resolve(null)),
    [slug, needsReader, viewer, userId],
    'Impossible de charger la fiche',
  );

  const reading = resolveEntryReading(publicEntry, viewer, readerEntry);

  /**
   * La fiche **lue**, ou `undefined`. Tout ce qui suit et dépend du lecteur
   * (trace de lecture, repères, favori, note) ne part que d'elle : une fiche
   * illisible ne déclenche aucun de ces appels.
   */
  const entry = reading.status === 'readable' ? reading.entry : undefined;
  /** En-tête affichable : celui de la fiche lue, ou celui d'une fiche illisible. */
  const header =
    reading.status === 'readable'
      ? reading.entry
      : reading.status === 'locked'
        ? reading.header
        : undefined;

  /**
   * Plan public du parcours, pour proposer l'étape précédente et la suivante.
   *
   * C'est la lecture de la page du parcours : sans session, parcours publié
   * seulement, étapes limitées aux fiches publiées. Un parcours inconnu ou en
   * brouillon donne `null`, donc aucun lien d'étape.
   *
   * L'erreur est volontairement **ignorée** : si ce plan ne peut pas être
   * obtenu, la fiche se lit normalement, avec le seul « Retour au parcours ».
   */
  const { data: path } = useAsyncData(
    () => (fromPath ? getLearningPath(fromPath) : Promise.resolve(null)),
    [fromPath],
    'Impossible de charger le parcours',
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

  // Titre de l'onglet : celui de la fiche, une fois chargée. `getEntryBySlug`
  // ne renvoie que des fiches publiées : pendant le chargement, ou pour une
  // fiche introuvable ou dépubliée, l'onglet garde le titre neutre. Le titre
  // d'une fiche réservée est public, il nomme donc l'onglet lui aussi.
  usePageTitle(header?.title);

  // `null` hors parcours, ou si la fiche n'est pas une étape de celui de l'adresse.
  const steps = slug ? adjacentSteps(path, slug) : null;

  // Accès des étapes voisines, pour annoncer « Compte requis » avant de les
  // ouvrir. Lecture publique ; rien n'est demandé pour un compte vérifié.
  const reservedStepIds = useReservedEntryIds(
    [steps?.previous?.id, steps?.next?.id].filter((id): id is string => id !== undefined),
  );

  /**
   * Repères du compte pour cette fiche : meilleur score et examen réussi ou
   * non. Lecture sous session, séparée de la lecture publique de la fiche, qui
   * reste identique pour tous. `undefined` pour un visiteur, pendant le
   * chargement ou en cas d'échec : aucune mention de score n'apparaît alors.
   */
  const states = useEntryStates(entry?.id ? [entry.id] : []);
  const state = entry?.id ? states?.byEntryId.get(entry.id) : undefined;

  /**
   * Ouvrir une fiche la compte comme lue.
   *
   * Uniquement si un compte est connecté (une trace de lecture appartient à un
   * compte) : un visiteur n'émet aucun appel. Et uniquement si la fiche est
   * **lue** : `entry` est absent d'une fiche illisible, dont la page floutée ne
   * compte pas comme une lecture (le serveur refuserait de toute façon).
   * L'appel est volontairement « silencieux » : lire une fiche doit fonctionner
   * même si l'enregistrement échoue, donc l'erreur est ignorée plutôt
   * qu'affichée.
   */
  useEffect(() => {
    if (!entry?.id || !userId) return;

    void markEntryRead(entry.id).catch(() => undefined);
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

  useEffect(() => {
    if (!entry?.id || !userId) return;

    const currentEntryId = entry.id;
    let cancelled = false;

    listNotes({ entryId: currentEntryId, limit: 1 })
      .then((result) => {
        if (cancelled) return;
        const content =
          result !== 'unauthorized' && result.items.length > 0 ? result.items[0].content : '';
        setNoteState({ entryId: currentEntryId, content });
        setNoteDraft(content);
      })
      .catch(() => {
        if (!cancelled) {
          setNoteState({ entryId: currentEntryId, content: '' });
          setNoteDraft('');
        }
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
          redirectToLogin();
        } else {
          setFavError('Une connexion est nécessaire pour marquer cette fiche.');
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

  async function onSaveNote() {
    if (!entry?.id || notePending) return;

    const currentEntryId = entry.id;
    setNotePending(true);
    setNoteError(null);
    setNoteSaved(false);

    try {
      const result = await saveNote(currentEntryId, noteDraft);

      if (result === 'unauthorized') {
        redirectToLogin();
        return;
      }

      const content = result === null ? '' : result.content;
      setNoteState({ entryId: currentEntryId, content });
      setNoteDraft(content);
      setNoteSaved(true);
    } catch (caught) {
      setNoteError(
        caught instanceof Error ? caught.message : "Impossible d'enregistrer cette note",
      );
    } finally {
      setNotePending(false);
    }
  }

  async function onDeleteNote() {
    if (!entry?.id || notePending) return;

    const currentEntryId = entry.id;
    setNotePending(true);
    setNoteError(null);
    setNoteSaved(false);

    try {
      const result = await deleteNote(currentEntryId);

      if (result === 'unauthorized') {
        redirectToLogin();
        return;
      }

      setNoteState({ entryId: currentEntryId, content: '' });
      setNoteDraft('');
    } catch (caught) {
      setNoteError(caught instanceof Error ? caught.message : 'Impossible de supprimer cette note');
    } finally {
      setNotePending(false);
    }
  }

  // L'échec de la lecture complète ne compte que si elle a été demandée.
  const loadError = error ?? (needsReader ? readerError : null);

  if (loadError) {
    return <ErrorMessage>{loadError}</ErrorMessage>;
  }

  // Lecture en cours, ou lecteur encore inconnu : le squelette, jamais la zone
  // floutée (elle annoncerait à tort un refus).
  if (reading.status === 'loading') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-3/4 rounded-lg" />
        <Skeleton className="h-5 w-1/2 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (reading.status === 'not-found' || !header) {
    return (
      <NotFoundState
        message="Fiche introuvable."
        listLink={{ to: '/stacks', label: 'Toutes les leçons' }}
      />
    );
  }

  const { category } = header;
  const { stack } = category;

  // Retour au parcours et fil d'Ariane : ils ne portent que des informations
  // publiques, ils s'affichent donc aussi au-dessus d'une fiche illisible.
  const lead = (
    <>
      {fromPath ? (
        <Link
          to={`/parcours/${encodeURIComponent(fromPath)}`}
          className="text-muted hover:text-foreground flex w-fit items-center gap-1.5 text-sm no-underline transition-colors duration-150"
        >
          <ArrowLeftIcon className="size-4" />
          Retour au parcours
        </Link>
      ) : null}
      <Breadcrumbs
        items={[
          { label: 'Leçons', to: '/stacks' },
          { label: stack.name, to: `/stacks/${stack.slug}` },
          { label: category.name, to: `/stacks/${stack.slug}/${category.slug}` },
          { label: header.title },
        ]}
      />
    </>
  );

  const stepNav =
    steps && fromPath ? (
      <EntryStepNav
        steps={steps}
        pathSlug={fromPath}
        reservedIds={reservedStepIds}
        viewer={viewer}
      />
    ) : null;

  /**
   * Fiche que ce lecteur ne peut pas lire : l'en-tête en clair, puis la zone
   * floutée et son message à la place du contenu. Le serveur n'a transmis que
   * l'en-tête ; il n'y a ni corps, ni fichiers, ni sources à passer.
   *
   * `returnTo` est l'adresse courante, `?parcours=` compris : après la
   * création du compte ou la connexion, le lecteur revient à cette fiche, dans
   * le même parcours.
   */
  if (reading.status === 'locked') {
    return (
      <EntryArticle
        title={header.title}
        summary={header.summary}
        kind={header.kind}
        difficulty={header.difficulty}
        tags={header.tags}
        lead={lead}
        locked={
          <ReservedContent
            reader={reading.reader}
            email={session?.user?.email}
            returnTo={currentReturnTo(location)}
          />
        }
        footer={stepNav}
      />
    );
  }

  const fullEntry = reading.entry;

  // Colonnes JSON de Prisma : validées avant d'être passées à Sandpack.
  const files = jsonToStringRecord(fullEntry.files);
  const dependencies = jsonToStringRecord(fullEntry.dependencies);

  // Un examen terminé existe pour ce compte : le bouton propose de le repasser.
  const hasFinishedExam = state !== undefined && state.bestScore !== null;

  /**
   * La présentation (en-tête, corps, playground, sources) appartient à
   * `EntryArticle`, partagé avec l'aperçu de l'administration. La page ne garde
   * que ce qui dépend du lecteur et de sa navigation :
   * - `lead` : retour au parcours et fil d'Ariane ;
   * - `headerActions` : le favori, seule action utile avant la lecture ;
   * - `footer` : ce qui se fait **après** avoir lu — examen, note, étape
   *   suivante, signalement. Rien de tout cela ne s'intercale entre le titre et
   *   le contenu : un lecteur connecté voit autant de leçon qu'un visiteur.
   */
  return (
    <EntryArticle
      title={fullEntry.title}
      summary={fullEntry.summary}
      kind={fullEntry.kind}
      difficulty={fullEntry.difficulty}
      tags={fullEntry.tags}
      bodyMdx={fullEntry.bodyMdx}
      template={fullEntry.template}
      files={files}
      dependencies={dependencies}
      sources={fullEntry.sources}
      verifiedOn={fullEntry.verifiedOn}
      verifiedVersion={fullEntry.verifiedVersion}
      lead={lead}
      headerActions={
        <>
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
        </>
      }
      footer={
        <>
          {/* Examen. Trois cas, décidés à partir de ce que dit le serveur :
              - la fiche n'a pas d'examen (`quizEligible` faux) : pas de bouton,
                et un compte connecté apprend que la lecture suffit ;
              - compte connecté : le bouton, avec le meilleur score s'il y en a
                un. Le parcours d'origine suit jusqu'à l'examen ;
              - visiteur : une invitation à se connecter, qui retient cette
                page (parcours compris) pour y revenir. Elle ne vaut que pour
                l'examen : favori et note restent absents sans session.
              Tant que la session n'est pas connue, rien n'est affiché : un
              compte connecté ne voit pas passer l'invitation du visiteur. */}
          {!fullEntry.quizEligible ? (
            userId ? (
              <p className="text-muted text-sm">
                Cette fiche n’a pas d’examen : sa lecture suffit à valider l’étape.
              </p>
            ) : null
          ) : userId ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                to={examHrefFromPath(fullEntry.slug, fromPath)}
                className={`${buttonVariants({ variant: 'primary' })} no-underline`}
              >
                {hasFinishedExam ? 'Repasser l’examen' : 'Passer l’examen'}
              </Link>
              {state && state.bestScore !== null ? (
                <p className="text-muted text-sm">
                  Meilleur score : {state.bestScore} / 100 ·{' '}
                  {state.passed ? 'examen réussi' : 'examen non réussi'}
                </p>
              ) : null}
            </div>
          ) : sessionPending ? null : (
            <div>
              <Link
                to={loginHref(currentReturnTo(location))}
                className={`${buttonVariants({ variant: 'secondary' })} no-underline`}
              >
                Se connecter pour passer l’examen
              </Link>
            </div>
          )}

          {userId && noteState?.entryId === fullEntry.id ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="entry-note" className="text-sm font-medium">
                Note personnelle
              </label>
              <textarea
                id="entry-note"
                value={noteDraft}
                onChange={(event) => {
                  setNoteDraft(event.target.value);
                  setNoteSaved(false);
                }}
                maxLength={MAX_NOTE_LENGTH}
                rows={4}
                placeholder="Un rappel personnel sur cette fiche, visible par ce compte seulement."
                className="border-border bg-background w-full rounded-lg border p-3 text-sm"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isDisabled={notePending || noteDraft === noteState.content}
                  onPress={() => {
                    void onSaveNote();
                  }}
                >
                  Enregistrer
                </Button>
                {noteState.content !== '' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    isDisabled={notePending}
                    onPress={() => {
                      void onDeleteNote();
                    }}
                  >
                    Supprimer
                  </Button>
                ) : null}
                {noteSaved ? <span className="text-muted text-xs">Enregistré.</span> : null}
                {noteError ? <span className="text-danger text-xs">{noteError}</span> : null}
              </div>
            </div>
          ) : null}

          {stepNav}

          {/* Pour tout lecteur, connecté ou non : le formulaire de contact
              est public. Seul le slug voyage dans l'adresse. */}
          <p className="text-muted text-xs">
            Une erreur dans cette fiche ?{' '}
            <Link
              to={reportHref(fullEntry.slug)}
              className="text-foreground rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
            >
              Signaler une erreur
            </Link>
          </p>
        </>
      }
    />
  );
}
