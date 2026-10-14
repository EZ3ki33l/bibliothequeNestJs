import { useId, useState, type KeyboardEvent } from 'react';
import { Button, Input, Label, TextField } from '@heroui/react';
import {
  ArrowLineDownIcon,
  FloppyDiskIcon,
  PencilSimpleIcon,
  TrashIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react';
import {
  formatBytes,
  removeEntryImage,
  updateEntryImage,
  uploadEntryImage,
  type EntryImageAdmin,
} from '../../lib/entryImages';
import { bodyCitesImage, mediaMarkdown, mediaUrl } from '../../lib/illustrations';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Typo } from '../ui/Typo';

/** Plafond affiché ; le serveur seul le fait respecter (409 au-delà). */
const MAX_IMAGES_PER_ENTRY = 20;
const MAX_ALT_LENGTH = 250;
const MAX_CAPTION_LENGTH = 300;
/** Formats que le serveur accepte. Le filtre du sélecteur n'est qu'un confort : le serveur lit le contenu. */
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

type AdminEntryImagesProps = {
  entryId: string;
  images: EntryImageAdmin[];
  onChange: (images: EntryImageAdmin[]) => void;
  /** Insère la référence Markdown dans le champ « Corps », au curseur. */
  onInsert: (markdown: string) => void;
  /** Lit le corps en cours de saisie (le formulaire est non contrôlé). */
  readBody: () => string;
};

/**
 * Images d'une fiche dans le formulaire d'administration (spec 016, story 3).
 *
 * Ce panneau est **à l'intérieur** du `<form>` de la fiche, sous le corps,
 * mais ne lui ajoute aucun champ : ses saisies n'ont pas d'attribut `name`,
 * donc `FormData` ne les lit pas, et la touche Entrée y lance l'action du
 * panneau au lieu d'enregistrer la fiche. Chaque action part tout de suite à
 * l'API : une image n'attend pas l'enregistrement de la fiche.
 *
 * Aucune décision de droit ici : un `ADMIN` sur une fiche publiée reçoit le
 * refus du serveur (403), affiché tel quel.
 */
export function AdminEntryImages({
  entryId,
  images,
  onChange,
  onInsert,
  readBody,
}: AdminEntryImagesProps) {
  const fileInputId = useId();
  /** Changer la clé remonte le sélecteur de fichier : c'est ainsi qu'il se vide après un envoi. */
  const [fileInputKey, setFileInputKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  /** Une seule image modifiée à la fois. */
  const [editing, setEditing] = useState<{ id: string; alt: string; caption: string } | null>(null);

  const isFull = images.length >= MAX_IMAGES_PER_ENTRY;

  /** La touche Entrée enregistrerait la fiche entière : elle lance l'action du panneau. */
  function onEnter(action: () => void) {
    return (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        action();
      }
    };
  }

  async function upload() {
    if (pending) {
      return;
    }

    if (file === null) {
      setError('Choisir un fichier PNG, JPEG ou WebP.');
      return;
    }
    if (alt.trim() === '') {
      setError('Le texte alternatif est obligatoire : il décrit l’image à qui ne la voit pas.');
      return;
    }

    setPending(true);
    setError(null);
    setStatus('');
    const result = await uploadEntryImage(entryId, file, alt.trim(), caption.trim());
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    // La réponse porte aussi `markdown` ; la liste ne garde que l'image.
    const { markdown: _markdown, ...image } = result.value;
    onChange([...images, image]);
    setFile(null);
    setAlt('');
    setCaption('');
    setFileInputKey((key) => key + 1);
    setStatus('Image ajoutée. « Insérer » la place dans le corps, au curseur.');
  }

  async function saveEdit() {
    if (editing === null || pending) {
      return;
    }
    if (editing.alt.trim() === '') {
      setError('Le texte alternatif est obligatoire.');
      return;
    }

    setPending(true);
    setError(null);
    setStatus('');
    const result = await updateEntryImage(entryId, editing.id, {
      alt: editing.alt.trim(),
      caption: editing.caption.trim(),
    });
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onChange(images.map((image) => (image.id === result.value.id ? result.value : image)));
    setEditing(null);
    setStatus('Image modifiée.');
  }

  async function remove(image: EntryImageAdmin) {
    if (pending) {
      return;
    }

    // Le retrait ne touche pas au corps : une référence restante s'affichera
    // comme une image introuvable. Mieux vaut le dire avant.
    const question = bodyCitesImage(readBody(), image.id)
      ? `Retirer « ${image.alt} » ? Le corps cite encore cette image : elle y sera remplacée par un cadre « Image non affichée ».`
      : `Retirer « ${image.alt} » ?`;
    if (!window.confirm(question)) {
      return;
    }

    setPending(true);
    setError(null);
    setStatus('');
    const result = await removeEntryImage(entryId, image.id);
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onChange(images.filter((item) => item.id !== image.id));
    if (editing?.id === image.id) {
      setEditing(null);
    }
    setStatus('Image retirée.');
  }

  function insert(image: EntryImageAdmin) {
    onInsert(mediaMarkdown(image.id, image.alt));
    setStatus('Référence insérée dans le corps.');
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${fileInputId}-title`}>
      <div>
        <Typo
          id={`${fileInputId}-title`}
          variant="small"
          as="p"
          className="text-foreground font-medium"
        >
          Images ({images.length}/{MAX_IMAGES_PER_ENTRY})
        </Typo>
        <Typo variant="caption" className="mt-0.5">
          PNG, JPEG ou WebP, 10 Mo au plus. Le site retire les métadonnées (position GPS comprise)
          et réencode l’image avant de la conserver.
        </Typo>
      </div>

      {images.length === 0 ? (
        <Typo variant="small" as="p">
          Aucune image.
        </Typo>
      ) : (
        <ul className="flex flex-col gap-3">
          {images.map((image) => {
            const isEditing = editing?.id === image.id;

            return (
              <li
                key={image.id}
                className="border-border flex flex-col gap-3 rounded-xl border p-3 sm:flex-row"
              >
                {/* Vignette : la version de lecture, réduite. Le texte
                    alternatif est écrit juste à côté, d'où `alt=""`. */}
                <img
                  src={mediaUrl(image.id, 'reading')}
                  alt=""
                  width={image.width}
                  height={image.height}
                  loading="lazy"
                  decoding="async"
                  className="bg-surface h-20 w-32 shrink-0 rounded-lg object-contain"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {isEditing ? (
                    <>
                      <TextField
                        value={editing.alt}
                        onChange={(value) => setEditing({ ...editing, alt: value })}
                        maxLength={MAX_ALT_LENGTH}
                        autoComplete="off"
                      >
                        <Label>Texte alternatif</Label>
                        <Input onKeyDown={onEnter(() => void saveEdit())} />
                      </TextField>
                      <TextField
                        value={editing.caption}
                        onChange={(value) => setEditing({ ...editing, caption: value })}
                        maxLength={MAX_CAPTION_LENGTH}
                        autoComplete="off"
                      >
                        <Label>Légende (optionnel)</Label>
                        <Input onKeyDown={onEnter(() => void saveEdit())} />
                      </TextField>
                    </>
                  ) : (
                    <>
                      <Typo variant="small" as="p" className="text-foreground break-words">
                        {image.alt}
                      </Typo>
                      {image.caption === '' ? null : (
                        <Typo variant="caption" className="break-words">
                          Légende : {image.caption}
                        </Typo>
                      )}
                      <Typo variant="caption">
                        {image.width} × {image.height} px à la lecture ·{' '}
                        {formatBytes(image.readingBytes + image.fullBytes)} stockés
                      </Typo>
                    </>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          isDisabled={pending}
                          onPress={() => void saveEdit()}
                        >
                          <FloppyDiskIcon className="size-4" />
                          Enregistrer l’image
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onPress={() => setEditing(null)}
                        >
                          Annuler
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onPress={() => insert(image)}
                        >
                          <ArrowLineDownIcon className="size-4" />
                          Insérer
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Modifier l’image « ${image.alt} »`}
                          onPress={() =>
                            setEditing({ id: image.id, alt: image.alt, caption: image.caption })
                          }
                        >
                          <PencilSimpleIcon className="size-4" />
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger-soft"
                          aria-label={`Retirer l’image « ${image.alt} »`}
                          isDisabled={pending}
                          onPress={() => void remove(image)}
                        >
                          <TrashIcon className="size-4" />
                          Retirer
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isFull ? (
        <Typo variant="small" as="p">
          Cette fiche a atteint {MAX_IMAGES_PER_ENTRY} images : en retirer une avant d’en ajouter
          une autre.
        </Typo>
      ) : (
        <div className="border-border flex flex-col gap-3 rounded-xl border border-dashed p-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={fileInputId} className="text-foreground text-sm font-medium">
              Fichier
            </label>
            {/* Pas d'attribut `name` : le fichier ne part pas avec la fiche. */}
            <input
              key={fileInputKey}
              id={fileInputId}
              type="file"
              accept={ACCEPTED_TYPES}
              className="text-muted file:bg-surface file:text-foreground file:border-border text-sm file:mr-3 file:rounded-lg file:border file:px-3 file:py-1.5"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            />
          </div>
          <TextField value={alt} onChange={setAlt} maxLength={MAX_ALT_LENGTH} autoComplete="off">
            <Label>Texte alternatif</Label>
            <Input
              placeholder="Trois postes reliés à un commutateur"
              onKeyDown={onEnter(() => void upload())}
            />
          </TextField>
          <TextField
            value={caption}
            onChange={setCaption}
            maxLength={MAX_CAPTION_LENGTH}
            autoComplete="off"
          >
            <Label>Légende (optionnel)</Label>
            <Input onKeyDown={onEnter(() => void upload())} />
          </TextField>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="self-start"
            isDisabled={pending}
            onPress={() => void upload()}
          >
            <UploadSimpleIcon className="size-4" />
            {pending ? 'Envoi…' : 'Envoyer l’image'}
          </Button>
        </div>
      )}

      {error === null ? null : <ErrorMessage>{error}</ErrorMessage>}
      {/* Toujours dans le DOM : un lecteur d'écran annonce chaque nouveau message. */}
      <Typo variant="small" as="p" role="status">
        {status}
      </Typo>
    </section>
  );
}
