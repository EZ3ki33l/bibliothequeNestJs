import { Chip } from '@heroui/react';
import { BookOpenIcon, LockIcon, SealCheckIcon } from '@phosphor-icons/react';
import type { EntryState } from '../../lib/entryProgress';
import { HeartIcon } from './HeartIcon';

/** Pictogramme et libellé côte à côte, avec un espace entre les deux. */
const MARKER_CLASS = 'inline-flex items-center gap-1';

/**
 * Repères d'une fiche pour le compte connecté : « Examen réussi » ou « Lue »,
 * et « Favori ».
 *
 * Sans `state` (visiteur, repères indisponibles, fiche jamais ouverte), le
 * composant ne rend **rien** : ni puce grisée ni emplacement vide, rien ne
 * suggère qu'un repère manque.
 *
 * « Examen réussi » remplace « Lue » : réussir l'examen suppose d'avoir lu, deux
 * puces diraient deux fois la même chose.
 *
 * Chaque repère porte un pictogramme **et** son libellé en toutes lettres : il
 * se comprend sans la couleur, et un lecteur d'écran lit le texte (le
 * pictogramme, décoratif, lui est masqué).
 *
 * `access` est la mention d'une fiche **réservée** (« Compte requis »,
 * « Adresse à vérifier »), placée avant les repères : c'est la première chose
 * à savoir avant d'ouvrir la fiche. Elle n'est qu'une annonce. Le libellé est
 * choisi par `accessMention` ; absent, rien n'est rendu à sa place.
 */
export function EntryMarkers({ state, access }: { state?: EntryState; access?: string }) {
  const hasState = state !== undefined && (state.passed || state.read || state.favorite);

  if (!access && !hasState) {
    return null;
  }

  return (
    <>
      {access ? (
        <Chip size="sm" variant="soft" color="warning">
          <span className={MARKER_CLASS}>
            <LockIcon aria-hidden="true" weight="fill" className="size-3.5" />
            {access}
          </span>
        </Chip>
      ) : null}
      {hasState ? <StateMarkers state={state} /> : null}
    </>
  );
}

function StateMarkers({ state }: { state: EntryState }) {
  return (
    <>
      {state.passed ? (
        <Chip size="sm" variant="soft" color="success">
          <span className={MARKER_CLASS}>
            <SealCheckIcon aria-hidden="true" weight="fill" className="size-3.5" />
            Examen réussi
          </span>
        </Chip>
      ) : state.read ? (
        <Chip size="sm" variant="soft">
          <span className={MARKER_CLASS}>
            <BookOpenIcon aria-hidden="true" className="size-3.5" />
            Lue
          </span>
        </Chip>
      ) : null}
      {state.favorite ? (
        <Chip size="sm" variant="soft">
          <span className={MARKER_CLASS}>
            <HeartIcon filled className="size-3.5" />
            Favori
          </span>
        </Chip>
      ) : null}
    </>
  );
}
