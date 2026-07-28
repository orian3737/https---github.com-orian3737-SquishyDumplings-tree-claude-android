import { describe, expect, it } from 'vitest';

import { createSeededRandom, sequenceRandom } from './random';
import {
  isRarity,
  maxEvolutionStageFor,
  RARITIES,
  rarityDropPercentLabel,
  rarityDropProbability,
  rollRarity,
  TOTAL_RARITY_WEIGHT,
  type Rarity,
} from './rarity';

describe('rarity table', () => {
  it('sums to the documented total weight', () => {
    expect(TOTAL_RARITY_WEIGHT).toBe(100);
  });

  it('probabilities sum to 1', () => {
    const total = RARITIES.reduce(
      (sum, rarity) => sum + rarityDropProbability(rarity),
      0,
    );
    expect(total).toBeCloseTo(1, 10);
  });

  it.each([
    ['common', '60.0%'],
    ['uncommon', '25.0%'],
    ['rare', '10.0%'],
    ['epic', '4.0%'],
    ['legendary', '1.0%'],
  ] as const)(
    'labels %s odds as %s for the disclosure screen',
    (rarity, label) => {
      expect(rarityDropPercentLabel(rarity)).toBe(label);
    },
  );

  it.each([
    ['common', 2],
    ['uncommon', 2],
    ['rare', 3],
    ['epic', 3],
    ['legendary', 4],
  ] as const)('caps %s at evolution stage %s', (rarity, maxStage) => {
    expect(maxEvolutionStageFor(rarity)).toBe(maxStage);
  });
});

describe('rollRarity boundaries', () => {
  // Each tier owns a half-open slice of [0, 1): common [0, .60),
  // uncommon [.60, .85), rare [.85, .95), epic [.95, .99), legendary [.99, 1).
  it.each([
    [0, 'common'],
    [0.5999, 'common'],
    [0.6, 'uncommon'],
    [0.8499, 'uncommon'],
    [0.85, 'rare'],
    [0.9499, 'rare'],
    [0.95, 'epic'],
    [0.9899, 'epic'],
    [0.99, 'legendary'],
    [0.999999, 'legendary'],
  ] as const)('roll %s produces %s', (value, expected) => {
    expect(rollRarity(sequenceRandom([value]))).toBe(expected);
  });
});

describe('rollRarity distribution', () => {
  it('tracks the configured weights over a seeded run', () => {
    const random = createSeededRandom(20260727);
    const counts: Record<Rarity, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    };
    const rolls = 20_000;

    for (let index = 0; index < rolls; index += 1) {
      counts[rollRarity(random)] += 1;
    }

    // Deterministic given the seed; the tolerance guards against a miswired
    // weight rather than against randomness.
    for (const rarity of RARITIES) {
      const expected = rarityDropProbability(rarity) * rolls;
      expect(counts[rarity]).toBeGreaterThan(expected * 0.8);
      expect(counts[rarity]).toBeLessThan(expected * 1.2);
    }
  });
});

describe('isRarity', () => {
  it.each([
    ['common', true],
    ['LEGENDARY', false],
    ['mythic', false],
    [undefined, false],
  ])('%s -> %s', (value, expected) => {
    expect(isRarity(value)).toBe(expected);
  });
});
