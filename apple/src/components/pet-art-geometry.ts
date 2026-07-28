/**
 * Where the sleeping dumpling actually is inside its sprite box.
 *
 * Anything drawn *onto* the pet — the sleep mask and the Do Not Disturb sign today,
 * worn skins later — needs to land on the art, and the art is not centred in its own
 * frame. The sleepy PNG is drawn 2.75% of the box right of centre, so overlays built
 * symmetric around `0.5` sit visibly left of the face: on the habitat's 184pt pet that
 * is a 5pt slip across a 92pt-wide mask, which is plainly visible.
 *
 * These fractions are measured from the shipped PNGs rather than guessed, and
 * `pet-art-geometry.test.ts` re-measures the real files to keep them honest. A sprite
 * delivery that reframes the character will fail that test, which is the point —
 * re-measure here and every overlay follows.
 *
 * **Scoped to the sleepy frame on purpose.** The prototype PNGs are not framed
 * consistently with each other: `idle`, `sleepy`, and `tongue` all centre on 0.5275,
 * but `happy` and `hop` centre near 0.467 and `wave` and `squat` land in between. Both
 * of today's overlays are worn only while the pet is asleep, which is always the sleepy
 * frame, so one number is correct and honest here. Anything that has to sit on the pet
 * across *all* states — worn skins in PR 10 — needs consistent framing in the real
 * sprite delivery, or a per-frame anchor table instead of this constant. That is a
 * requirement on the art, not something an overlay can compensate for.
 *
 * This module stays free of React Native imports so those measurements can be checked
 * in a plain Node test.
 *
 * All values are fractions of the sprite box, which `contentFit="contain"` makes equal
 * to fractions of the rendered `size` while both the art and the box stay square.
 */

/** Horizontal centre of the character on the sleepy frame. */
export const PET_ART_CENTER_X = 0.5275;

/** The eye line — vertical centre of the closed eyes on the sleepy frame. */
export const PET_ART_EYE_LINE_Y = 0.46;

/** Width of the head silhouette at the eye line, for anything that spans the face. */
export const PET_ART_HEAD_WIDTH_AT_EYES = 0.668;

/**
 * Thickness of the character's dark outline.
 *
 * Anything that spans the face has to stop short of the edge by at least this much.
 * A strap drawn out to the exact silhouette width covers the outline at its ends, and
 * the break in that dark edge reads as the strap bursting through the dumpling rather
 * than passing behind its head.
 */
export const PET_ART_OUTLINE_WIDTH = 0.012;

/**
 * How far to nudge an overlay that a caller has already centred on its own box, to
 * put it on the character instead.
 *
 * The habitat centres the pet's *box* on its walk position, so a sign or badge
 * centred the same way drifts off the face by exactly this much.
 */
export const PET_ART_CENTER_OFFSET = PET_ART_CENTER_X - 0.5;

/** A rectangle in sprite-box fractions. Multiply by a rendered `size` to get points. */
export type ArtRect = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

const centredOnFace = (width: number, height: number): ArtRect => ({
  height,
  left: PET_ART_CENTER_X - width / 2,
  top: PET_ART_EYE_LINE_Y - height / 2,
  width,
});

/**
 * The sleep mask's pad — the part that has to cover both closed eyes.
 *
 * Wider than the eyes themselves so it reads as a worn object with some slack, not as
 * a sticker cut to fit.
 */
export const SLEEP_MASK_PAD: ArtRect = centredOnFace(0.5, 0.15);

/**
 * The strap, running the width of the head along the eye line.
 *
 * Stops one outline-width short on each side. That is the difference between a strap
 * that disappears behind the head and one that looks like it has been driven through
 * it: the character's dark edge has to survive underneath, and going any narrower
 * makes the ends read as floating inside the body instead of continuing past it.
 */
export const SLEEP_MASK_STRAP: ArtRect = centredOnFace(
  PET_ART_HEAD_WIDTH_AT_EYES - 2 * PET_ART_OUTLINE_WIDTH,
  0.045,
);
