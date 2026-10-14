import { Module } from '@nestjs/common';
import { AdminEntryImagesController } from './admin-entry-images.controller';
import { EntryImagesService } from './entry-images.service';
import { ImageEncoder } from './image-encoder';
import { IMAGE_STORAGE } from './image-storage';
import { MediaCache } from './media-cache';
import { MediaController } from './media.controller';
import { UploadThingImageStorage } from './uploadthing-image-storage';

/**
 * Frontière du domaine « illustrations d'une fiche » (spec 016).
 *
 * Même montage que `ContactModule` : le jeton `IMAGE_STORAGE` est associé à
 * UploadThing, et les tests remplacent cette seule ligne. Le cache est une
 * instance unique (`useValue`) : un seul cache pour tout le relais.
 *
 * `EntryImagesService` est exporté : les services des fiches, catégories et
 * leçons l'appellent pour retirer les fichiers après une suppression.
 */
@Module({
  controllers: [AdminEntryImagesController, MediaController],
  providers: [
    EntryImagesService,
    ImageEncoder,
    { provide: MediaCache, useValue: new MediaCache() },
    { provide: IMAGE_STORAGE, useClass: UploadThingImageStorage },
  ],
  exports: [EntryImagesService],
})
export class EntryImagesModule {}
