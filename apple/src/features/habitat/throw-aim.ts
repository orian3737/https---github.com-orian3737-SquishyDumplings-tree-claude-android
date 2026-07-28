/**
 * Where a thrown item lands.
 *
 * Split out from the habitat loop because it is the only part of feeding that is
 * pure arithmetic, and because the owner's complaint — food "just goes somewhere
 * random" — was a bug in exactly this mapping: the flick vector never reached it.
 *
 * Coordinates are fractions of the floor band. Depth runs from 0 at the back wall
 * to 1 at the player's feet, so throwing harder means a *smaller* y.
 */

/** The raw upward flick that threw the item, straight from the wheel's gesture. */
export type ThrowAim = Readonly<{
  dx: number;
  dy: number;
  vx: number;
  vy: number;
}>;

export type LandingBounds = Readonly<{
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}>;

/**
 * X is bounded by the dumpling rather than by the food: the pet walks to whatever
 * it can reach, and further out than this its body hangs off the screen edge.
 *
 * `maxY` is supplied per-screen rather than fixed, because the action wheel covers
 * the bottom of the floor and only the screen knows how much.
 */
export const LANDING_MIN_X = 0.22;
export const LANDING_MAX_X = 0.78;
export const LANDING_MIN_Y = 0.14;

/**
 * How deep the floor is usable before the screen has reported its layout.
 *
 * Conservative on purpose: it keeps food and messes above the wheel even when no
 * better value is available yet.
 */
export const DEFAULT_LANDING_MAX_Y = 0.6;

/**
 * Horizontal flick travel, in points, that throws all the way to the edge of the
 * landing band. A reference distance rather than a screen fraction: the wheel is a
 * fixed-size control, so the same wrist movement aims the same way on every iPhone.
 */
const AIM_FULL_DEFLECTION_DX = 130;
/** Upward travel that lands at the player's feet, and at the back wall. */
const AIM_SHORTEST_DY = 30;
const AIM_LONGEST_DY = 210;
/**
 * How far the landing point wanders from where it was aimed.
 *
 * Small on purpose. Aim should dominate — that was the whole complaint — but a
 * throw that lands on exactly the same spot every time reads as a UI element
 * rather than as something tumbling across a floor.
 */
const AIM_SCATTER = 0.03;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function boundsFor(maxY: number): LandingBounds {
  return {
    minX: LANDING_MIN_X,
    maxX: LANDING_MAX_X,
    minY: LANDING_MIN_Y,
    // A caller that hands over a maxY at or above the wall would invert the band.
    maxY: Math.max(LANDING_MIN_Y, maxY),
  };
}

/**
 * The landing spot for one throw.
 *
 * `aim` is null for the accessible tap path, which has no direction to read: that
 * lands mid-floor with a wider scatter rather than pretending to have aimed.
 */
export function landingFor(
  aim: ThrowAim | null,
  bounds: LandingBounds,
  random: () => number,
): { x: number; y: number } {
  const scatter = (spread = 1) => (random() - 0.5) * 2 * AIM_SCATTER * spread;

  if (aim === null) {
    return {
      x: clamp(0.5 + scatter(3), bounds.minX, bounds.maxX),
      y: clamp(
        (bounds.minY + bounds.maxY) / 2 + scatter(3),
        bounds.minY,
        bounds.maxY,
      ),
    };
  }

  // Sideways travel aims across the room, proportional to how far the flick went.
  const lateral = clamp(aim.dx / AIM_FULL_DEFLECTION_DX, -1, 1);
  const x = 0.5 + lateral * (bounds.maxX - bounds.minX) * 0.5;

  // A harder upward flick throws further, which on this floor means further back.
  const reach = clamp(
    (Math.abs(aim.dy) - AIM_SHORTEST_DY) / (AIM_LONGEST_DY - AIM_SHORTEST_DY),
    0,
    1,
  );
  const y = bounds.maxY - reach * (bounds.maxY - bounds.minY);

  return {
    x: clamp(x + scatter(), bounds.minX, bounds.maxX),
    y: clamp(y + scatter(), bounds.minY, bounds.maxY),
  };
}

/** A spot anywhere on the usable floor, for messes the player did not aim. */
export function randomFloorSpot(
  bounds: LandingBounds,
  random: () => number,
): { x: number; y: number } {
  return {
    x: bounds.minX + random() * (bounds.maxX - bounds.minX),
    y: bounds.minY + random() * (bounds.maxY - bounds.minY),
  };
}
