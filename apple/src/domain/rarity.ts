import type { RandomSource } from './random';

/**
 * Rarity tiers ported from the Android `Rarity` reference.
 *
 * `dropWeight` values are relative weights, not percentages. The disclosure UI
 * required before any randomized roll must read its odds from
 * `rarityDropPercentLabel` so displayed odds and the actual roll cannot drift
 * apart.
 *
 * The roll here is the local/provisional implementation. BUILD_SPEC section 6
 * requires the shipping authority for skin and rarity outcomes to be
 * server-side, because users can reinstall, retry, and revive. PR 6 and PR 7
 * replace this with a server function.
 *
 * Android's `colorHex` is deliberately not ported: BUILD_SPEC section 8 says the
 * Android palette is not the visual source of truth for Apple.
 */
export const RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;

export type Rarity = (typeof RARITIES)[number];

export type RarityDefinition = Readonly<{
  rarity: Rarity;
  displayName: string;
  dropWeight: number;
  maxEvolutionStage: number;
}>;

export const RARITY_TABLE: Readonly<Record<Rarity, RarityDefinition>> = {
  common: {
    rarity: 'common',
    displayName: 'Common',
    dropWeight: 60,
    maxEvolutionStage: 2,
  },
  uncommon: {
    rarity: 'uncommon',
    displayName: 'Uncommon',
    dropWeight: 25,
    maxEvolutionStage: 2,
  },
  rare: {
    rarity: 'rare',
    displayName: 'Rare',
    dropWeight: 10,
    maxEvolutionStage: 3,
  },
  epic: {
    rarity: 'epic',
    displayName: 'Epic',
    dropWeight: 4,
    maxEvolutionStage: 3,
  },
  legendary: {
    rarity: 'legendary',
    displayName: 'Legendary',
    dropWeight: 1,
    maxEvolutionStage: 4,
  },
};

export const TOTAL_RARITY_WEIGHT = RARITIES.reduce(
  (total, rarity) => total + RARITY_TABLE[rarity].dropWeight,
  0,
);

export function rarityDefinition(rarity: Rarity): RarityDefinition {
  return RARITY_TABLE[rarity];
}

export function maxEvolutionStageFor(rarity: Rarity): number {
  return RARITY_TABLE[rarity].maxEvolutionStage;
}

/** Probability in the range 0–1. */
export function rarityDropProbability(rarity: Rarity): number {
  return RARITY_TABLE[rarity].dropWeight / TOTAL_RARITY_WEIGHT;
}

/** Human-readable odds for the mandatory disclosure screen, e.g. "10.0%". */
export function rarityDropPercentLabel(rarity: Rarity): string {
  return `${(rarityDropProbability(rarity) * 100).toFixed(1)}%`;
}

/**
 * Rolls one rarity from the weighted table.
 *
 * `random.next()` is in [0, 1), so the roll lands in [0, TOTAL_RARITY_WEIGHT)
 * and each tier owns a half-open slice: common [0, 60), uncommon [60, 85), rare
 * [85, 95), epic [95, 99), legendary [99, 100).
 */
export function rollRarity(random: RandomSource): Rarity {
  const roll = random.next() * TOTAL_RARITY_WEIGHT;
  let cumulative = 0;

  for (const rarity of RARITIES) {
    cumulative += RARITY_TABLE[rarity].dropWeight;
    if (roll < cumulative) {
      return rarity;
    }
  }

  // Unreachable for a source honoring [0, 1); keeps the return type total.
  return 'legendary';
}

export function isRarity(value: unknown): value is Rarity {
  return (
    typeof value === 'string' && (RARITIES as readonly string[]).includes(value)
  );
}
