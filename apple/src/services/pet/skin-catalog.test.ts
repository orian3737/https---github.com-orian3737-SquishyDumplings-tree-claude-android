import { describe, expect, it } from 'vitest';

import { createSeededRandom, RARITIES, sequenceRandom } from '@/domain';

import {
  DEFAULT_SKIN_ID,
  findSkin,
  rollFirstSkin,
  SKIN_CATALOG,
  skinDisplayName,
  skinsOfRarity,
} from './skin-catalog';

describe('catalog integrity', () => {
  it.each(RARITIES)(
    'has at least one %s skin, so the roll is total',
    (rarity) => {
      expect(skinsOfRarity(rarity).length).toBeGreaterThan(0);
    },
  );

  it('has unique ids', () => {
    const ids = SKIN_CATALOG.map((skin) => skin.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes the default skin', () => {
    expect(findSkin(DEFAULT_SKIN_ID)).not.toBeNull();
  });

  it('gives every skin a display name', () => {
    for (const skin of SKIN_CATALOG) {
      expect(skin.displayName.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('skinDisplayName', () => {
  it('names a known skin', () => {
    expect(skinDisplayName(DEFAULT_SKIN_ID)).toBe('Classic Steamer');
  });

  it('falls back for an unknown id rather than showing a raw identifier', () => {
    expect(skinDisplayName('skin-from-a-future-build')).toBe('Mystery Wrapper');
  });
});

describe('rollFirstSkin', () => {
  it.each([
    [0, 'common'],
    [0.6, 'uncommon'],
    [0.85, 'rare'],
    [0.95, 'epic'],
    [0.99, 'legendary'],
  ] as const)('a rarity roll of %s grants a %s skin', (value, expected) => {
    // Two draws per roll: rarity, then the skin within that rarity.
    const result = rollFirstSkin(sequenceRandom([value, 0]));

    expect(result.rarity).toBe(expected);
    expect(result.skin.rarity).toBe(expected);
  });

  it('always grants a skin whose rarity matches the roll', () => {
    const random = createSeededRandom(2026);

    for (let index = 0; index < 500; index += 1) {
      const result = rollFirstSkin(random);

      expect(result.skin.rarity).toBe(result.rarity);
      expect(findSkin(result.skin.id)).not.toBeNull();
    }
  });

  it('reaches more than one rarity over a seeded run', () => {
    const random = createSeededRandom(7);
    const seen = new Set<string>();

    for (let index = 0; index < 500; index += 1) {
      seen.add(rollFirstSkin(random).rarity);
    }

    expect(seen.size).toBeGreaterThan(1);
  });
});
