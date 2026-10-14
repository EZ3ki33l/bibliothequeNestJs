import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import {
  FULL_MAX_BYTES,
  FULL_MAX_SIDE,
  READING_MAX_BYTES,
  READING_MAX_WIDTH,
} from '../common/image-limits';
import { ImageEncoder, TOO_MANY_PIXELS, UNSUPPORTED_FORMAT } from './image-encoder';

const encoder = new ImageEncoder();

/** Image unie construite par sharp, dans le format demandé. */
function solid(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#4854ad' } });
}

/** Bruit aléatoire : une image qui se compresse mal, comme une photo. */
function noise(width: number, height: number) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = Math.floor(Math.random() * 256);
  return sharp(pixels, { raw: { width, height, channels: 3 } });
}

async function expectRefusal(input: Buffer, message: string) {
  await expect(encoder.encode(input)).rejects.toEqual(new BadRequestException(message));
}

describe('ImageEncoder', () => {
  it('removes EXIF, GPS and device data from a phone photo, and applies its orientation', async () => {
    const photo = await solid(400, 200)
      .jpeg()
      .withExif({
        IFD0: { Make: 'Téléphone', Model: 'Modèle X', Artist: 'Personne' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '48/1 51/1 24/1' },
      })
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const { reading, full } = await encoder.encode(photo);

    for (const variant of [reading, full]) {
      const meta = await sharp(variant.buffer).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      // Orientation 6 = rotation d'un quart de tour : 400 × 200 devient 200 × 400.
      expect([meta.width, meta.height]).toEqual([200, 400]);
    }
  });

  it('bounds the dimensions of both versions and keeps a small image as is', async () => {
    const big = await solid(6000, 4000).png().toBuffer();
    const { reading, full } = await encoder.encode(big);

    expect(reading.width).toBeLessThanOrEqual(READING_MAX_WIDTH);
    expect(Math.max(full.width, full.height)).toBeLessThanOrEqual(FULL_MAX_SIDE);

    const small = await solid(300, 120).webp().toBuffer();
    const kept = await encoder.encode(small);
    expect([kept.reading.width, kept.reading.height]).toEqual([300, 120]);
    expect([kept.full.width, kept.full.height]).toEqual([300, 120]);
  });

  it('keeps each version under its weight budget, even for a noisy photo', async () => {
    const photo = await noise(3000, 2000).jpeg({ quality: 95 }).toBuffer();
    const { reading, full } = await encoder.encode(photo);

    expect(reading.bytes).toBeLessThanOrEqual(READING_MAX_BYTES);
    expect(full.bytes).toBeLessThanOrEqual(FULL_MAX_BYTES);
    expect(reading.bytes).toBe(reading.buffer.length);
  }, 30_000);

  it('encodes a screenshot without loss in its full version when it fits', async () => {
    const screenshot = await solid(800, 600).png().toBuffer();
    const { full } = await encoder.encode(screenshot);

    const pixels = await sharp(full.buffer).raw().toBuffer();
    // Aplat sans perte : chaque pixel garde exactement sa couleur.
    expect([pixels[0], pixels[1], pixels[2]]).toEqual([0x48, 0x54, 0xad]);
  });

  it.each([
    ['a text file renamed .png', Buffer.from('ceci n’est pas une image')],
    ['an empty buffer', Buffer.alloc(0)],
    [
      'an SVG',
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
      ),
    ],
  ])('refuses %s', async (_label, input) => {
    await expectRefusal(input, UNSUPPORTED_FORMAT);
  });

  it('refuses a GIF, whatever its name', async () => {
    const gif = await solid(10, 10).gif().toBuffer();
    await expectRefusal(gif, UNSUPPORTED_FORMAT);
  });

  it('refuses an image announcing more than 50 million pixels', async () => {
    // 8 000 × 7 000 = 56 millions : l'en-tête suffit, rien n'est décodé.
    const huge = await solid(8000, 7000).png({ compressionLevel: 9 }).toBuffer();
    await expectRefusal(huge, TOO_MANY_PIXELS);
  }, 30_000);

  it('refuses a truncated file', async () => {
    const photo = await noise(200, 200).jpeg().toBuffer();
    await expectRefusal(photo.subarray(0, Math.floor(photo.length / 3)), UNSUPPORTED_FORMAT);
  });
});
