import { BadRequestException, Injectable } from '@nestjs/common';
import sharp, { type ResizeOptions, type SharpOptions, type WebpOptions } from 'sharp';
import {
  FULL_MAX_BYTES,
  FULL_MAX_SIDE,
  MAX_INPUT_PIXELS,
  READING_MAX_BYTES,
  READING_MAX_WIDTH,
} from '../common/image-limits';

/** Une version encodée d'une image. */
export type EncodedVariant = { buffer: Buffer; width: number; height: number; bytes: number };

/** Les deux versions d'une image envoyée. */
export type EncodedImage = { reading: EncodedVariant; full: EncodedVariant };

export const UNSUPPORTED_FORMAT = 'Format non accepté : PNG, JPEG ou WebP.';
export const TOO_MANY_PIXELS = 'Image trop grande : 50 millions de pixels au plus.';
export const TOO_COMPLEX = 'Image trop complexe pour être compressée sous la limite.';

/** Formats acceptés, **d'après le contenu** du fichier (jamais son nom ni le type annoncé). */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

/**
 * Options de lecture : `limitInputPixels` arrête le décodage d'une image
 * démesurée (second rideau après le contrôle de l'en-tête), `failOn: 'error'`
 * refuse un fichier corrompu ou tronqué.
 */
const INPUT: SharpOptions = { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' };

/** Réductions successives de 15 % quand les paliers de qualité ne suffisent pas. */
const MAX_SHRINK_STEPS = 4;
const SHRINK_FACTOR = 0.85;

/**
 * Vérifie et réencode une image envoyée (spec 016, research § 4).
 *
 * Réencoder garantit que le fichier servi est une image **produite par le
 * site** : un fichier qui ressemble à une image mais contient autre chose
 * (« polyglotte ») n'y survit pas, et aucune métadonnée d'origine (position
 * GPS, appareil, auteur, date) n'est recopiée : sharp n'écrit rien de tel tant
 * qu'on ne le lui demande pas.
 *
 * Deux versions WebP, chacune sous un budget de poids garanti : la qualité
 * baisse par paliers, puis les dimensions de 15 % par palier ; si rien ne
 * suffit, l'envoi est refusé.
 */
@Injectable()
export class ImageEncoder {
  async encode(input: Buffer): Promise<EncodedImage> {
    // L'en-tête seul est lu, aucun pixel n'est décodé : la limite de pixels
    // est vérifiée juste après, avec un message qui la nomme. Avec
    // `limitInputPixels` ici, sharp refuserait l'en-tête lui-même et l'erreur
    // se confondrait avec un format non accepté.
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(input, { failOn: 'error', limitInputPixels: false }).metadata();
    } catch {
      throw new BadRequestException(UNSUPPORTED_FORMAT);
    }

    if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
      throw new BadRequestException(UNSUPPORTED_FORMAT);
    }

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width <= 0 || height <= 0) {
      throw new BadRequestException(UNSUPPORTED_FORMAT);
    }
    if (width * height > MAX_INPUT_PIXELS) {
      throw new BadRequestException(TOO_MANY_PIXELS);
    }

    // Capture d'écran, palette : aplats et texte supportent mal la perte.
    const sharpEdges = metadata.format === 'png';

    const reading = await this.variant(
      input,
      { width: READING_MAX_WIDTH, withoutEnlargement: true },
      READING_MAX_BYTES,
      sharpEdges
        ? [85, 75, 65, 55].map((quality) => ({ quality, smartSubsample: true }))
        : [80, 70, 60, 50].map((quality) => ({ quality })),
    );

    const full = await this.variant(
      input,
      { width: FULL_MAX_SIDE, height: FULL_MAX_SIDE, fit: 'inside', withoutEnlargement: true },
      FULL_MAX_BYTES,
      sharpEdges
        ? [
            { lossless: true },
            ...[90, 80, 70, 60].map((quality) => ({ quality, smartSubsample: true })),
          ]
        : [90, 80, 70, 60].map((quality) => ({ quality })),
    );

    return { reading, full };
  }

  /**
   * Une version : l'image est décodée **une fois** (orientation appliquée,
   * couleurs en sRGB, dimensions bornées) en pixels bruts, puis encodée en
   * WebP palier par palier jusqu'à tenir `maxBytes`.
   *
   * `.rotate()` sans argument applique l'orientation EXIF **avant** que les
   * métadonnées disparaissent : sinon une photo de téléphone ressortirait
   * couchée.
   */
  private async variant(
    input: Buffer,
    sizing: ResizeOptions,
    maxBytes: number,
    attempts: WebpOptions[],
  ): Promise<EncodedVariant> {
    let decoded: { data: Buffer; info: sharp.OutputInfo };
    try {
      decoded = await sharp(input, INPUT)
        .rotate()
        .toColorspace('srgb')
        .resize(sizing)
        .raw()
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new BadRequestException(UNSUPPORTED_FORMAT);
    }

    const { data, info } = decoded;
    const raw = { raw: { width: info.width, height: info.height, channels: info.channels } };

    for (let step = 0; step <= MAX_SHRINK_STEPS; step += 1) {
      const scale = SHRINK_FACTOR ** step;
      const width = Math.max(1, Math.round(info.width * scale));
      const height = Math.max(1, Math.round(info.height * scale));

      for (const options of attempts) {
        const pipeline = sharp(data, raw);
        const sized = step === 0 ? pipeline : pipeline.resize(width, height);
        const out = await sized.webp(options).toBuffer({ resolveWithObject: true });

        if (out.data.length <= maxBytes) {
          return {
            buffer: out.data,
            width: out.info.width,
            height: out.info.height,
            bytes: out.data.length,
          };
        }
      }
    }

    throw new BadRequestException(TOO_COMPLEX);
  }
}
