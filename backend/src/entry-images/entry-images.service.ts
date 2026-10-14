import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { AdminRole } from '../generated/prisma/enums';
import { assertUnlocked } from '../common/editorial-rights';
import {
  IMAGE_UPLOAD_WINDOW_MS,
  MAX_IMAGE_UPLOADS_PER_HOUR,
  MAX_IMAGES_PER_ENTRY,
  STORAGE_LIMIT_BYTES,
  uploadRetryAt,
} from '../common/image-limits';
import type { UpdateEntryImageDto } from './dto/update-entry-image.dto';
import type { UploadEntryImageDto } from './dto/upload-entry-image.dto';
import { ENTRY_IMAGE_SELECT, markdownReference, toAdminImage } from './entry-image.view';
import { ImageEncoder } from './image-encoder';
import { IMAGE_STORAGE, type ImageStorage } from './image-storage';
import { MediaCache } from './media-cache';
import { STORAGE_UNAVAILABLE } from './uploadthing-image-storage';

export const TOO_MANY_IMAGES = `Cette fiche a déjà ${MAX_IMAGES_PER_ENTRY} images.`;
export const STORAGE_FULL = 'Espace de stockage des images presque plein : envoi refusé.';
export const NO_FILE = 'Un fichier image est attendu (PNG, JPEG ou WebP).';
export const NOTHING_TO_UPDATE = 'Rien à modifier : texte alternatif ou légende attendu.';

/** Les deux versions servies par le relais. */
export type MediaVariant = 'reading' | 'full';

/** Ce que le service lit du fichier reçu : son contenu, rien d'autre (ni nom, ni type annoncé). */
export type UploadedImageFile = { buffer: Buffer };

/**
 * Illustrations d'une fiche (spec 016, story 3).
 *
 * Une image **appartient à une fiche** : elle en suit les droits (un `ADMIN` ne
 * touche qu'aux images d'un brouillon) et disparaît avec elle. Elle est
 * vérifiée et réencodée ici (`ImageEncoder`), conservée chez le prestataire
 * (`IMAGE_STORAGE`) et servie par le relais public (`readVariant`).
 *
 * La base est la source de vérité : une image absente de la base n'est plus
 * servie, même si son fichier reste un temps chez le prestataire (un retrait
 * raté se rattrape avec `pnpm images:reconcile`).
 */
@Injectable()
export class EntryImagesService {
  private readonly logger = new Logger(EntryImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encoder: ImageEncoder,
    private readonly cache: MediaCache,
    @Inject(IMAGE_STORAGE) private readonly storage: ImageStorage,
  ) {}

  /**
   * Envoi d'une image. Contrôles du moins coûteux au plus coûteux : fiche et
   * droits, plafonds connus en base, puis le fichier (décodage et encodage),
   * le volume (connu seulement après l'encodage), enfin le prestataire.
   */
  async upload(
    entryId: string,
    file: UploadedImageFile | undefined,
    dto: UploadEntryImageDto,
    role: AdminRole,
    userId: string,
  ) {
    const entry = await this.prisma.entry.findUnique({
      where: { id: entryId },
      select: { published: true },
    });
    if (!entry) {
      throw new NotFoundException();
    }
    assertUnlocked(role, entry.published);

    const count = await this.prisma.entryImage.count({ where: { entryId } });
    if (count >= MAX_IMAGES_PER_ENTRY) {
      throw new ConflictException(TOO_MANY_IMAGES);
    }

    await this.assertUnderUploadQuota(userId);

    if (!file || file.buffer.length === 0) {
      throw new BadRequestException(NO_FILE);
    }

    const { reading, full } = await this.encoder.encode(file.buffer);

    const used = await this.usedBytes();
    if (used + reading.bytes + full.bytes > STORAGE_LIMIT_BYTES) {
      throw new ConflictException(STORAGE_FULL);
    }

    const id = randomUUID();
    const [readingFile, fullFile] = await this.storage.put([
      { name: `${id}-reading.webp`, body: reading.buffer },
      { name: `${id}-full.webp`, body: full.buffer },
    ]);

    try {
      const row = await this.prisma.entryImage.create({
        data: {
          id,
          entryId,
          alt: dto.alt,
          caption: dto.caption ?? '',
          readingKey: readingFile.key,
          fullKey: fullFile.key,
          readingWidth: reading.width,
          readingHeight: reading.height,
          readingBytes: reading.bytes,
          fullWidth: full.width,
          fullHeight: full.height,
          fullBytes: full.bytes,
          uploadedById: userId,
        },
        select: ENTRY_IMAGE_SELECT,
      });

      return { ...toAdminImage(row), markdown: markdownReference(row.id, row.alt) };
    } catch (error) {
      // Compensation : rien ne reste chez le prestataire pour une image
      // qui n'existe pas en base.
      await this.storage.remove([readingFile.key, fullFile.key]);

      // Fiche supprimée entre le contrôle et l'écriture : même réponse qu'une
      // fiche inconnue.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  /** Texte alternatif et légende. L'image est cherchée **avec sa fiche** : une image d'une autre fiche donne 404. */
  async update(entryId: string, imageId: string, dto: UpdateEntryImageDto, role: AdminRole) {
    if (dto.alt === undefined && dto.caption === undefined) {
      throw new BadRequestException(NOTHING_TO_UPDATE);
    }

    await this.findUnlocked(entryId, imageId, role);

    const row = await this.prisma.entryImage.update({
      where: { id: imageId },
      data: { alt: dto.alt, caption: dto.caption },
      select: ENTRY_IMAGE_SELECT,
    });

    return toAdminImage(row);
  }

  /**
   * Retrait d'une image : elle cesse d'être servie aussitôt (la ligne est
   * supprimée et le cache vidé). Le retrait chez le prestataire vient ensuite ;
   * son échec ne change pas la réponse.
   */
  async remove(entryId: string, imageId: string, role: AdminRole): Promise<void> {
    const image = await this.findUnlocked(entryId, imageId, role);

    await this.prisma.entryImage.delete({ where: { id: imageId } });
    await this.purge([image.readingKey, image.fullKey]);
  }

  /** Volume occupé chez le prestataire, d'après la base. */
  async usage() {
    const { _sum, _count } = await this.prisma.entryImage.aggregate({
      _sum: { readingBytes: true, fullBytes: true },
      _count: { _all: true },
    });

    return {
      usedBytes: (_sum.readingBytes ?? 0) + (_sum.fullBytes ?? 0),
      limitBytes: STORAGE_LIMIT_BYTES,
      imageCount: _count._all,
    };
  }

  /**
   * Clés des images des fiches désignées par `where`, relevées **avant** une
   * suppression de fiche, de catégorie ou de leçon : la cascade de la base
   * emporte les lignes, il faut savoir quels fichiers retirer ensuite.
   */
  async keysFor(where: Prisma.EntryWhereInput): Promise<string[]> {
    const images = await this.prisma.entryImage.findMany({
      where: { entry: where },
      select: { readingKey: true, fullKey: true },
    });

    return images.flatMap((image) => [image.readingKey, image.fullKey]);
  }

  /**
   * Vide le cache et retire les fichiers chez le prestataire. Ne lève jamais :
   * un échec est journalisé (clés seulement) et se rattrape par
   * `pnpm images:reconcile`.
   */
  async purge(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    for (const key of keys) {
      this.cache.delete(key);
    }

    const removed = await this.storage.remove(keys);
    if (!removed) {
      this.logger.warn(`Image files not removed, reconcile later : ${keys.join(', ')}`);
    }
  }

  /**
   * Contenu d'une version, pour le relais public. Quel que soit l'état de la
   * fiche (libre, réservée, brouillon), une image se sert à qui connaît son
   * identifiant (spec 016, clarification Q2) ; l'identifiant n'apparaît que
   * dans une lecture qui avait le droit de lire la fiche.
   */
  async readVariant(imageId: string, variant: MediaVariant): Promise<Buffer> {
    const image = await this.prisma.entryImage.findUnique({
      where: { id: imageId },
      select: { readingKey: true, fullKey: true },
    });
    if (!image) {
      throw new NotFoundException();
    }

    const key = variant === 'reading' ? image.readingKey : image.fullKey;

    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const body = await this.storage.read(key);
    if (!body) {
      throw new ServiceUnavailableException(STORAGE_UNAVAILABLE);
    }

    this.cache.set(key, body);
    return body;
  }

  /** Image de **cette** fiche, droits vérifiés ; 404 sinon (inconnue, ou d'une autre fiche). */
  private async findUnlocked(entryId: string, imageId: string, role: AdminRole) {
    const image = await this.prisma.entryImage.findFirst({
      where: { id: imageId, entryId },
      select: { readingKey: true, fullKey: true, entry: { select: { published: true } } },
    });
    if (!image) {
      throw new NotFoundException();
    }

    assertUnlocked(role, image.entry.published);
    return image;
  }

  private async usedBytes(): Promise<number> {
    return (await this.usage()).usedBytes;
  }

  /**
   * Plafond d'envois par compte (429), sur le modèle des examens : la base
   * connaît déjà les images et leur date, rien n'est stocké en plus.
   */
  private async assertUnderUploadQuota(userId: string): Promise<void> {
    const now = new Date();

    const recent = await this.prisma.entryImage.findMany({
      where: {
        uploadedById: userId,
        createdAt: { gt: new Date(now.getTime() - IMAGE_UPLOAD_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_IMAGE_UPLOADS_PER_HOUR,
      select: { createdAt: true },
    });

    const retryAt = uploadRetryAt(
      recent.map((image) => image.createdAt),
      now,
    );

    if (retryAt) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Trop d’images envoyées. Un nouvel envoi sera possible plus tard.',
          retryAt: retryAt.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
