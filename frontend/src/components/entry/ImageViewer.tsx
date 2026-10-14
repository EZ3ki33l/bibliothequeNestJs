import { Modal } from '@heroui/react';
import { mediaUrl, type EntryIllustrationImage } from '../../lib/illustrations';
import { Typo } from '../ui/Typo';

type ImageViewerProps = {
  image: EntryIllustrationImage;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

/**
 * Version pleine d'une image, ouverte en grand dans la page (spec 016, FR-016b).
 *
 * Fenêtre modale de HeroUI (react-aria dessous) : le focus y est piégé, la
 * touche Échap et le bouton « Fermer » la referment, et le focus revient à
 * l'élément qui l'a ouverte. La version pleine n'est demandée **qu'à
 * l'ouverture** : la fenêtre n'est pas rendue tant qu'elle est fermée.
 */
export function ImageViewer({ image, isOpen, onOpenChange }: ImageViewerProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="cover" placement="center">
        <Modal.Dialog aria-label={`Image en taille réelle : ${image.alt}`}>
          <Modal.CloseTrigger aria-label="Fermer" />
          <Modal.Body className="flex flex-col items-center gap-3">
            <img
              src={mediaUrl(image.id, 'full')}
              alt={image.alt}
              width={image.fullWidth}
              height={image.fullHeight}
              decoding="async"
              className="image-viewer-img"
            />
            {image.caption === '' ? null : (
              <Typo variant="small" className="text-center">
                {image.caption}
              </Typo>
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
