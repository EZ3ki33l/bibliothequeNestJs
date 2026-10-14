import { ImageBrokenIcon } from '@phosphor-icons/react';

/**
 * Ce qui s'affiche **à la place** d'une image que le site ne charge pas : image
 * venue d'un autre site, adresse inconnue, image retirée ou relais
 * indisponible (spec 016, FR-002).
 *
 * Aucune requête n'est faite : le cadre ne contient que du texte. Il dit
 * qu'une image n'est pas affichée (pictogramme **et** libellé, compréhensible
 * sans la couleur), puis le texte alternatif écrit par le rédacteur s'il
 * existe.
 *
 * Des `<span>` seulement : une image Markdown se trouve souvent dans un
 * paragraphe, où un bloc (`<div>`, `<p>`) serait du HTML invalide.
 */
export function BlockedImage({ alt }: { alt?: string }) {
  const text = alt?.trim() ?? '';

  return (
    <span
      role="img"
      aria-label={text === '' ? 'Image non affichée' : `Image non affichée : ${text}`}
      className="blocked-image"
    >
      <span aria-hidden="true" className="inline-flex items-center gap-1.5 font-medium">
        <ImageBrokenIcon weight="bold" className="size-4 shrink-0" />
        Image non affichée
      </span>
      {text === '' ? null : (
        <span aria-hidden="true" className="text-foreground">
          {text}
        </span>
      )}
    </span>
  );
}
