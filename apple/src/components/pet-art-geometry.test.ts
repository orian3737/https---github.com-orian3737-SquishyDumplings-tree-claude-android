/// <reference types="node" />
// Scoped to this file on purpose. This test reads the PNGs off disk, but the app is a
// React Native bundle with no `Buffer` and no `fs`, so pulling Node's globals into the
// whole project's type space would let app code reference APIs that are not there at
// runtime.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  PET_ART_CENTER_OFFSET,
  PET_ART_CENTER_X,
  PET_ART_EYE_LINE_Y,
  PET_ART_HEAD_WIDTH_AT_EYES,
  PET_ART_OUTLINE_WIDTH,
  SLEEP_MASK_PAD,
  SLEEP_MASK_STRAP,
} from './pet-art-geometry';

/**
 * These constants describe the shipped sprite art, so the only test worth writing
 * measures the shipped sprite art. Guessing the eye line put the sleep mask on the
 * dumpling's forehead once already; this is what stops a redelivered sprite sheet from
 * doing it again silently.
 *
 * The prototype PNGs are 8-bit RGBA and non-interlaced, so a small decoder over
 * `node:zlib` reads them without adding an image dependency to the project.
 */

const ASSETS = join(__dirname, '..', '..', 'assets', 'prototype');

/**
 * The frame both overlays are worn over.
 *
 * The mask keys off `state === 'sleepy'`, and the sign renders only when the habitat is
 * `fullyAsleep`, which forces the same state. So this is the whole surface the
 * constants have to be right about.
 */
const MASKED_FRAME = 'sleepy';

/**
 * Frames that share the sleepy frame's centre, so the constant is checked as a real
 * property of the art rather than one lucky measurement.
 *
 * Deliberately not every frame: `happy`, `hop`, `wave`, and `squat` are framed
 * differently in the prototype art. See the note in `pet-art-geometry.ts` — that
 * inconsistency is a constraint on the real sprite delivery, and no overlay is worn
 * over those frames today.
 */
const CONSISTENTLY_FRAMED = ['idle', 'sleepy', 'tongue'] as const;

type Bitmap = Readonly<{
  width: number;
  height: number;
  /** RGBA, four bytes per pixel, row-major. */
  data: Buffer;
}>;

function decodePng(bytes: Buffer): Bitmap {
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const interlace = bytes[28];

  // The decoder below only claims to handle what these assets are.
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `Unsupported PNG: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`,
    );
  }

  const parts: Buffer[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') {
      parts.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(parts));
  const bpp = 4;
  const stride = width * bpp;
  const data = Buffer.alloc(stride * height);

  /**
   * Read a byte, treating out-of-bounds as zero.
   *
   * That is the PNG spec's own rule for filter operands that fall off the top or left
   * edge (section 9.2), so this satisfies `noUncheckedIndexedAccess` by stating the
   * real semantics rather than by asserting the index is safe.
   */
  const at = (buffer: Buffer, index: number): number => buffer[index] ?? 0;

  // Undo the per-scanline filters.
  for (let y = 0; y < height; y += 1) {
    const filter = at(raw, y * (stride + 1));
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;

    for (let x = 0; x < stride; x += 1) {
      const value = at(raw, src + x);
      const left = x >= bpp ? at(data, dst + x - bpp) : 0;
      const above = y > 0 ? at(data, up + x) : 0;
      const upLeft = y > 0 && x >= bpp ? at(data, up + x - bpp) : 0;

      let recon: number;
      switch (filter) {
        case 0:
          recon = value;
          break;
        case 1:
          recon = value + left;
          break;
        case 2:
          recon = value + above;
          break;
        case 3:
          recon = value + ((left + above) >> 1);
          break;
        case 4: {
          const p = left + above - upLeft;
          const dLeft = Math.abs(p - left);
          const dAbove = Math.abs(p - above);
          const dUpLeft = Math.abs(p - upLeft);
          recon =
            value +
            (dLeft <= dAbove && dLeft <= dUpLeft
              ? left
              : dAbove <= dUpLeft
                ? above
                : upLeft);
          break;
        }
        default:
          throw new Error(`Unknown PNG filter ${filter} on row ${y}`);
      }
      data[dst + x] = recon & 0xff;
    }
  }

  return { data, height, width };
}

function loadFrame(name: string): Bitmap {
  return decodePng(readFileSync(join(ASSETS, `dumpling_${name}.png`)));
}

/** Off the edge of the bitmap is transparent black, so zero is the right default. */
const byteAt = ({ data }: Bitmap, index: number): number => data[index] ?? 0;

const alphaAt = (bitmap: Bitmap, x: number, y: number) =>
  byteAt(bitmap, (y * bitmap.width + x) * 4 + 3);

/** Opaque and dark: the character's outline, eyes, and mouth. */
function isInk(bitmap: Bitmap, x: number, y: number): boolean {
  const i = (y * bitmap.width + x) * 4;
  const luminanceSum =
    byteAt(bitmap, i) + byteAt(bitmap, i + 1) + byteAt(bitmap, i + 2);
  return byteAt(bitmap, i + 3) > 200 && luminanceSum < 330;
}

/** Horizontal span of the silhouette on one row, as fractions of the box. */
function silhouetteRow(bitmap: Bitmap, fracY: number) {
  const y = Math.round(fracY * bitmap.height);
  let left = -1;
  let right = -1;
  for (let x = 0; x < bitmap.width; x += 1) {
    if (alphaAt(bitmap, x, y) > 16) {
      if (left < 0) left = x;
      right = x;
    }
  }
  if (left < 0) {
    throw new Error(`No silhouette at y=${fracY}`);
  }
  return {
    center: (left + right) / 2 / bitmap.width,
    width: (right - left) / bitmap.width,
  };
}

/**
 * The eye pixels on the masked frame.
 *
 * Ink inside the face, excluding the mouth: the two eyes are the outermost ink runs in
 * the band, and the mouth sits between and below them.
 */
function eyePixels(bitmap: Bitmap) {
  const { height, width } = bitmap;
  const found: { x: number; y: number }[] = [];
  for (let y = Math.round(height * 0.38); y < height * 0.6; y += 1) {
    for (let x = Math.round(width * 0.28); x < width * 0.72; x += 1) {
      if (isInk(bitmap, x, y)) {
        found.push({ x, y });
      }
    }
  }

  // Group the ink into columns runs, splitting wherever there is a clear gap.
  type Run = Readonly<{ start: number; end: number }>;
  const COLUMN_GAP = 8;

  const columns = [...new Set(found.map((p) => p.x))].sort((a, b) => a - b);
  const runs = columns.reduce<readonly Run[]>((acc, c) => {
    const last = acc.at(-1);
    if (!last || c - last.end > COLUMN_GAP) {
      return [...acc, { end: c, start: c }];
    }
    return [...acc.slice(0, -1), { ...last, end: c }];
  }, []);

  // Two eyes with the mouth between them. If this ever stops holding, the frame has
  // been redrawn and every measurement below it is meaningless — so fail loudly here
  // rather than silently measuring the wrong ink.
  expect(runs).toHaveLength(3);
  const leftEye = runs.at(0);
  const rightEye = runs.at(-1);
  if (!leftEye || !rightEye) {
    throw new Error('No eye runs found on the masked frame');
  }

  const inEye = (x: number) =>
    (x >= leftEye.start && x <= leftEye.end) ||
    (x >= rightEye.start && x <= rightEye.end);

  return found
    .filter((p) => inEye(p.x))
    .map((p) => ({ x: p.x / width, y: p.y / height }));
}

describe('measured pet art geometry', () => {
  it('the character is drawn off-centre in its box, which is why the offset exists', () => {
    // If this ever becomes 0.5, the offset plumbing can be deleted rather than kept
    // as a no-op that future overlays copy.
    expect(PET_ART_CENTER_OFFSET).not.toBe(0);
    expect(PET_ART_CENTER_X).toBeGreaterThan(0.5);
  });

  it.each(CONSISTENTLY_FRAMED)('%s is centred at the art centre', (frame) => {
    const bitmap = loadFrame(frame);
    // Several rows through the head, so this is the character's framing and not one
    // row that happens to agree.
    for (const fracY of [0.4, 0.46, 0.52]) {
      expect(silhouetteRow(bitmap, fracY).center).toBeCloseTo(
        PET_ART_CENTER_X,
        2,
      );
    }
  });

  it('the head width at the eye line matches the constant the strap is sized from', () => {
    const bitmap = loadFrame(MASKED_FRAME);
    expect(silhouetteRow(bitmap, PET_ART_EYE_LINE_Y).width).toBeCloseTo(
      PET_ART_HEAD_WIDTH_AT_EYES,
      2,
    );
  });

  it('the eye line falls on the eyes', () => {
    const eyes = eyePixels(loadFrame(MASKED_FRAME));
    const top = Math.min(...eyes.map((p) => p.y));
    const bottom = Math.max(...eyes.map((p) => p.y));

    expect(PET_ART_EYE_LINE_Y).toBeGreaterThanOrEqual(top);
    expect(PET_ART_EYE_LINE_Y).toBeLessThanOrEqual(bottom);
  });
});

describe('sleep mask placement', () => {
  it('covers every eye pixel', () => {
    const eyes = eyePixels(loadFrame(MASKED_FRAME));
    const right = SLEEP_MASK_PAD.left + SLEEP_MASK_PAD.width;
    const bottom = SLEEP_MASK_PAD.top + SLEEP_MASK_PAD.height;

    const uncovered = eyes.filter(
      (p) =>
        p.x < SLEEP_MASK_PAD.left ||
        p.x > right ||
        p.y < SLEEP_MASK_PAD.top ||
        p.y > bottom,
    );

    expect(uncovered).toEqual([]);
  });

  it('sits on the face, not the middle of the frame', () => {
    // The bug this replaces: a pad centred on 0.5 while the face sits at 0.5275.
    const padCenter = SLEEP_MASK_PAD.left + SLEEP_MASK_PAD.width / 2;
    expect(padCenter).toBeCloseTo(PET_ART_CENTER_X, 5);

    const strapCenter = SLEEP_MASK_STRAP.left + SLEEP_MASK_STRAP.width / 2;
    expect(strapCenter).toBeCloseTo(PET_ART_CENTER_X, 5);
  });

  it('keeps the whole strap on the character, not just its middle', () => {
    const bitmap = loadFrame(MASKED_FRAME);
    const strapRight = SLEEP_MASK_STRAP.left + SLEEP_MASK_STRAP.width;
    const strapBottom = SLEEP_MASK_STRAP.top + SLEEP_MASK_STRAP.height;

    // Checked across the strap's full height on purpose. The body narrows going up, so
    // a strap that fits at its own centre line can still have its top corners hanging
    // in empty space beside the cheek — which is what the original geometry did.
    for (const fracY of [
      SLEEP_MASK_STRAP.top,
      PET_ART_EYE_LINE_Y,
      strapBottom,
    ]) {
      const row = silhouetteRow(bitmap, fracY);
      const bodyLeft = row.center - row.width / 2;
      const bodyRight = row.center + row.width / 2;

      expect(SLEEP_MASK_STRAP.left).toBeGreaterThanOrEqual(bodyLeft);
      expect(strapRight).toBeLessThanOrEqual(bodyRight);
    }
  });

  it('stops short of the outline so the silhouette survives', () => {
    const bitmap = loadFrame(MASKED_FRAME);
    const row = silhouetteRow(bitmap, PET_ART_EYE_LINE_Y);
    const bodyLeft = row.center - row.width / 2;
    const bodyRight = row.center + row.width / 2;
    const strapRight = SLEEP_MASK_STRAP.left + SLEEP_MASK_STRAP.width;

    // Flush ends cover the character's dark edge, and the break in it reads as the
    // strap bursting out of the dumpling. Both ends have to clear it.
    //
    // Allowed one source pixel of slack: the exported constants are rounded, and the
    // silhouette is a pixel wider on the right than the left, so demanding the exact
    // outline width on both sides would be asserting precision the measurements do not
    // have. One pixel at 512 is 0.03pt on the habitat's pet.
    const ONE_SOURCE_PIXEL = 1 / 512;
    const minimumClearance = PET_ART_OUTLINE_WIDTH - ONE_SOURCE_PIXEL;

    expect(SLEEP_MASK_STRAP.left - bodyLeft).toBeGreaterThanOrEqual(
      minimumClearance,
    );
    expect(bodyRight - strapRight).toBeGreaterThanOrEqual(minimumClearance);
  });

  it('spans wider than the eyes so it reads as worn, not cut to fit', () => {
    const eyes = eyePixels(loadFrame(MASKED_FRAME));
    const eyeSpan =
      Math.max(...eyes.map((p) => p.x)) - Math.min(...eyes.map((p) => p.x));

    expect(SLEEP_MASK_PAD.width).toBeGreaterThan(eyeSpan);
    // ...but not so wide it swallows the whole head and stops reading as a mask.
    expect(SLEEP_MASK_PAD.width).toBeLessThan(PET_ART_HEAD_WIDTH_AT_EYES);
  });
});
