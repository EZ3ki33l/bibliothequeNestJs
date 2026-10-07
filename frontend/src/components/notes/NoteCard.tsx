import { useId, useState } from 'react';
import { Button } from '@heroui/react';
import { MAX_NOTE_LENGTH, type NoteItem } from '../../lib/notes';
import { EntryCard } from '../ui/EntryCard';
import { ErrorMessage } from '../ui/ErrorMessage';

type NoteCardProps = {
  note: NoteItem;
  /** Mention d'accès de la fiche, si elle est réservée pour ce lecteur. */
  access?: string;
  /** Cette note est en cours de modification. */
  editing: boolean;
  /** Une **autre** note est en cours de modification : une seule à la fois. */
  editDisabled: boolean;
  onEdit: () => void;
  onCancel: () => void;
  /** Reçoit le texte saisi ; un texte vide supprime la note, comme sur la fiche. */
  onSave: (content: string) => void;
  onRemove: () => void;
  /** Enregistrement ou suppression en cours pour cette note. */
  pending: boolean;
  /** Message du dernier échec sur cette note. */
  error: string | null;
};

/** Au-delà, la note est repliée et « Afficher la suite » la déplie. */
const COLLAPSE_AFTER_CHARS = 320;
const COLLAPSE_AFTER_LINES = 5;

function isLong(content: string): boolean {
  return content.length > COLLAPSE_AFTER_CHARS || content.split('\n').length > COLLAPSE_AFTER_LINES;
}

/**
 * Une note de la page « Notes » : la fiche concernée, le texte **entier**, et
 * sa modification sur place.
 *
 * Composant de présentation : il n'appelle pas l'API. La page décide quelle
 * note est en modification (une seule à la fois) et fait l'enregistrement.
 *
 * `whitespace-pre-wrap` conserve les retours à la ligne saisis. Le texte est
 * rendu par React comme du texte : du balisage qui y serait écrit s'affiche tel
 * quel, il n'est jamais interprété.
 */
export function NoteCard({
  note,
  access,
  editing,
  editDisabled,
  onEdit,
  onCancel,
  onSave,
  onRemove,
  pending,
  error,
}: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const long = isLong(note.content);

  return (
    <article className="flex flex-col gap-3">
      <EntryCard entry={note.entry} access={access} />

      {editing ? (
        // Monté seulement pendant la modification : son brouillon repart du
        // texte enregistré à chaque ouverture, donc « Annuler » rend bien le
        // texte d'avant. Tant qu'il reste monté (échec compris), la saisie
        // reste à l'écran.
        <NoteEditor
          entryTitle={note.entry.title}
          initialContent={note.content}
          pending={pending}
          error={error}
          onCancel={onCancel}
          onSave={onSave}
        />
      ) : (
        <>
          <p
            id={contentId}
            className={`text-sm wrap-break-word whitespace-pre-wrap ${
              long && !expanded ? 'line-clamp-5' : ''
            }`}
          >
            {note.content}
          </p>
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          <div className="flex flex-wrap items-center gap-2">
            {long ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={expanded}
                aria-controls={contentId}
                onPress={() => setExpanded((current) => !current)}
              >
                {expanded ? 'Réduire' : 'Afficher la suite'}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isDisabled={editDisabled || pending}
              aria-label={`Modifier la note sur ${note.entry.title}`}
              onPress={onEdit}
            >
              Modifier
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              isDisabled={editDisabled || pending}
              aria-label={`Supprimer la note sur ${note.entry.title}`}
              onPress={onRemove}
            >
              Supprimer la note
            </Button>
          </div>
        </>
      )}
    </article>
  );
}

type NoteEditorProps = {
  entryTitle: string;
  initialContent: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (content: string) => void;
};

function NoteEditor({
  entryTitle,
  initialContent,
  pending,
  error,
  onCancel,
  onSave,
}: NoteEditorProps) {
  const [draft, setDraft] = useState(initialContent);
  const fieldId = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium">
        Note sur {entryTitle}
      </label>
      <textarea
        id={fieldId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={MAX_NOTE_LENGTH}
        rows={8}
        // La modification vient d'être demandée : le curseur va dans la zone.
        autoFocus
        disabled={pending}
        aria-describedby={`${fieldId}-count`}
        className="border-border bg-background w-full rounded-lg border p-3 text-sm"
      />
      <p id={`${fieldId}-count`} className="text-muted text-xs">
        {draft.length} / {MAX_NOTE_LENGTH} caractères
        {draft.trim() === '' ? ' · une note vide est supprimée à l’enregistrement' : ''}
      </p>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          isDisabled={pending || draft === initialContent}
          onPress={() => onSave(draft)}
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="ghost" size="sm" isDisabled={pending} onPress={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
