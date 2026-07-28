import { describe, expect, it } from 'vitest';

import { needs } from './__fixtures__/pet';
import {
  cleanlinessAfterTap,
  hygieneSummary,
  needsCleaning,
  poopPileCount,
  PROVISIONAL_HYGIENE_CONFIG,
} from './hygiene';
import { NEED_MAX, NEED_MIN } from './needs';

const config = PROVISIONAL_HYGIENE_CONFIG;

describe('poopPileCount', () => {
  it.each([
    [100, 0],
    [81, 0],
    [80, 1],
    [61, 1],
    [60, 2],
    [40, 3],
    [20, 4],
    [0, 5],
  ])('cleanliness %s shows %s piles', (cleanliness, expected) => {
    expect(poopPileCount(cleanliness, config)).toBe(expected);
  });

  it('never exceeds the cap, so the habitat stays tappable', () => {
    const tight = { ...config, cleanlinessPerPile: 1, maxPiles: 3 };

    expect(poopPileCount(NEED_MIN, tight)).toBe(3);
  });

  it('clamps corrupt input rather than producing negative piles', () => {
    expect(poopPileCount(9999, config)).toBe(0);
    expect(poopPileCount(-500, config)).toBe(config.maxPiles);
    expect(poopPileCount(Number.NaN, config)).toBe(config.maxPiles);
  });

  it('survives a zero-per-pile config without dividing by zero', () => {
    expect(poopPileCount(50, { ...config, cleanlinessPerPile: 0 })).toBe(
      config.maxPiles,
    );
  });
});

describe('hygieneSummary', () => {
  it('reports a clean habitat', () => {
    expect(hygieneSummary(NEED_MAX, config)).toBe('The habitat is clean.');
  });

  it('uses the singular for one mess', () => {
    expect(hygieneSummary(80, config)).toBe('1 mess to clean up.');
  });

  it('warns as the habitat gets dirtier', () => {
    expect(hygieneSummary(60, config)).toContain('getting uncomfortable');
  });

  it('escalates at the cap', () => {
    expect(hygieneSummary(NEED_MIN, config)).toContain('very uncomfortable');
  });

  it('always says something, so the state is never silent to a screen reader', () => {
    for (let cleanliness = 0; cleanliness <= 100; cleanliness += 5) {
      expect(hygieneSummary(cleanliness, config).length).toBeGreaterThan(0);
    }
  });
});

describe('cleanlinessAfterTap', () => {
  it('restores one pile worth of cleanliness', () => {
    expect(cleanlinessAfterTap(40, config)).toBe(60);
  });

  it('reduces the visible pile count', () => {
    const before = poopPileCount(40, config);
    const after = poopPileCount(cleanlinessAfterTap(40, config), config);

    expect(after).toBeLessThan(before);
  });

  it('cannot exceed the ceiling', () => {
    expect(cleanlinessAfterTap(95, config)).toBe(NEED_MAX);
  });

  it('clears the habitat after enough taps', () => {
    let cleanliness = NEED_MIN;

    for (let tap = 0; tap < config.maxPiles; tap += 1) {
      cleanliness = cleanlinessAfterTap(cleanliness, config);
    }

    expect(poopPileCount(cleanliness, config)).toBe(0);
  });
});

describe('needsCleaning', () => {
  it.each([
    [needs({ cleanliness: 100 }), false],
    [needs({ cleanliness: 81 }), false],
    [needs({ cleanliness: 80 }), true],
    [needs({ cleanliness: 0 }), true],
  ])('case %# needs cleaning: %s', (input, expected) => {
    expect(needsCleaning(input, config)).toBe(expected);
  });
});
