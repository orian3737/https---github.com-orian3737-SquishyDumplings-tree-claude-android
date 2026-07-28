/**
 * Randomness is injected so rarity rolls and ambient behavior are reproducible
 * in tests.
 *
 * Anything a user could reinstall, retry, or attach value to must ultimately be
 * rolled server-side (see BUILD_SPEC section 6). These sources exist for the
 * local domain engine, prototypes, and seeded tests — not as the shipping
 * authority for skin or rarity outcomes.
 */
export type RandomSource = {
  /** A value in the half-open range [0, 1). */
  next(): number;
};

export const systemRandom: RandomSource = {
  next: () => Math.random(),
};

/**
 * mulberry32. Small, fast, and good enough for reproducible gameplay rolls.
 * Not cryptographically secure, and never used for anything security relevant.
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  return {
    next: () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/**
 * Replays a fixed list of values, then repeats the last one. Lets a test pin an
 * exact boundary (for example the first value that should roll Legendary)
 * without reasoning about a generator's internal state.
 */
export function sequenceRandom(values: readonly number[]): RandomSource {
  if (values.length === 0) {
    throw new Error('sequenceRandom requires at least one value');
  }

  let index = 0;

  return {
    next: () => {
      const value = values[Math.min(index, values.length - 1)] as number;
      index += 1;
      return value;
    },
  };
}
