/**
 * The four needs, ported from the Android `PetStats` reference.
 *
 * Every value is an integer from 0 through 100. `cleanliness` is internal only:
 * the habitat shows its inverse as the Stinky meter, so cleanliness and Stinky
 * are never presented as two separate meters.
 */
export const NEED_NAMES = [
  'hunger',
  'cleanliness',
  'energy',
  'happiness',
] as const;

export type NeedName = (typeof NEED_NAMES)[number];

export type Needs = Readonly<Record<NeedName, number>>;

export const NEED_MIN = 0;
export const NEED_MAX = 100;

/** BUILD_SPEC section 6: a fresh dumpling starts at 80 across the board. */
export const INITIAL_NEED_VALUE = 80;

/** BUILD_SPEC section 6: neglected when hunger or cleanliness drops below this. */
export const NEGLECT_THRESHOLD = 20;

export function createInitialNeeds(): Needs {
  return {
    hunger: INITIAL_NEED_VALUE,
    cleanliness: INITIAL_NEED_VALUE,
    energy: INITIAL_NEED_VALUE,
    happiness: INITIAL_NEED_VALUE,
  };
}

/**
 * Rounds to an integer and clamps into 0–100. This is the only way a need value
 * should ever be written, so clock skew, long offline periods, and corrupt
 * cached state cannot produce an out-of-range need (FR-7).
 */
export function clampNeed(value: number): number {
  if (!Number.isFinite(value)) {
    return NEED_MIN;
  }

  return Math.min(NEED_MAX, Math.max(NEED_MIN, Math.round(value)));
}

export function clampNeeds(needs: Needs): Needs {
  return {
    hunger: clampNeed(needs.hunger),
    cleanliness: clampNeed(needs.cleanliness),
    energy: clampNeed(needs.energy),
    happiness: clampNeed(needs.happiness),
  };
}

/** Returns a new Needs with one value moved by `delta` and re-clamped. */
export function adjustNeed(needs: Needs, name: NeedName, delta: number): Needs {
  return {
    ...needs,
    [name]: clampNeed(needs[name] + delta),
  };
}

/**
 * Integer average of the four needs. Android used integer division, so this
 * floors rather than rounds; the evolution gate depends on the exact value.
 */
export function moodOf(needs: Needs): number {
  const total =
    clampNeed(needs.hunger) +
    clampNeed(needs.cleanliness) +
    clampNeed(needs.energy) +
    clampNeed(needs.happiness);

  return Math.floor(total / NEED_NAMES.length);
}

export function isNeglected(needs: Needs): boolean {
  return (
    clampNeed(needs.hunger) < NEGLECT_THRESHOLD ||
    clampNeed(needs.cleanliness) < NEGLECT_THRESHOLD
  );
}

/** Zero energy is a hard sleep boundary, not merely another low-energy bias. */
export function isFullyExhausted(needs: Needs): boolean {
  return clampNeed(needs.energy) === NEED_MIN;
}

/**
 * The player-facing Stinky value. Cleanliness itself is never rendered as a
 * meter — only this inverse is.
 */
export function stinkinessOf(cleanliness: number): number {
  return NEED_MAX - clampNeed(cleanliness);
}

export function isNeedName(value: unknown): value is NeedName {
  return (
    typeof value === 'string' &&
    (NEED_NAMES as readonly string[]).includes(value)
  );
}
