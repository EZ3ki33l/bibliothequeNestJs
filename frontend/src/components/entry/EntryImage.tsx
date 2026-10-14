import { useState } from 'react';
import { mediaUrl, type EntryIllustrationImage } from '../../lib/illustrations';
import { BlockedImage } from './BlockedImage';
import { ImageViewer } from './ImageViewer';

/**
 * Une image du site dans le corps d'une fiche (spec 016, story 3).
 *
 * - La **version de lecture** s'affiche, avec ses dimensions : la place est
 *   réservée avant son arrivée, la page ne saute pas. `loading="lazy"` : une
 *   image éloignée de la partie visible n'est téléchargée qu'à l'approche.
 * - Le texte alternatif est celui **enregistré** avec l'image (obligatoire à
 *   l'envoi), pas celui écrit dans le Markdown : une image du site est toujours
 *   décrite.
 * - Un bouton ouvre la **version pleine** en grand ; un lien l'ouvre seule
 *   dans un nouvel onglet. Ni l'un ni l'autre ne la télécharge avant d'être
 *   utilisé.
 * - Si l'image ne vient pas (relais indisponible, image retirée entre-temps),
 *   le cadre « Image non affichée » la remplace.
 *
 * Des `<span>` avec `role="figure"` plutôt que `<figure>` : une image écrite au
 * milieu d'une phrase reste dans son paragraphe, où un `<figure>` serait du
 * HTML invalide. Une image seule sur sa ligne est sortie du paragraphe par
 * `rehype-unwrap-images` et s'affiche en bloc (`index.css`).
 */
export function EntryImage({ image }: { image: EntryIllustrationImage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <BlockedImage alt={image.alt} />;
  }

  return (
    <span role="figure" aria-label={image.alt} className="entry-image">
      <button
        type="button"
        className="entry-image-button"
        aria-label={`Agrandir l’image : ${image.alt}`}
        onClick={() => setIsOpen(true)}
      >
        <img
          src={mediaUrl(image.id, 'reading')}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </button>
      <span className="entry-image-caption">
        {image.caption === '' ? null : <span>{image.caption}</span>}
        <a
          href={mediaUrl(image.id, 'full')}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Taille réelle : ${image.alt} (nouvel onglet)`}
        >
          Taille réelle
        </a>
      </span>
      {isOpen ? <ImageViewer image={image} isOpen={isOpen} onOpenChange={setIsOpen} /> : null}
    </span>
  );
}
