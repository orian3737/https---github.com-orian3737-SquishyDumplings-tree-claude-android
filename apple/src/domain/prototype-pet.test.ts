import { describe, expect, it } from 'vitest';

import { clampNeed, getStinkiness, prototypePet } from './prototype-pet';

describe('prototype pet foundation', () => {
  it.each([
    [-10, 0],
    [41.6, 42],
    [130, 100],
  ])('clamps %s to %s', (input, expected) => {
    expect(clampNeed(input)).toBe(expected);
  });

  it('represents one persistent dumpling identity', () => {
    expect(prototypePet.id).toBe('prototype-bao');
    expect(prototypePet.skinName).toBeTruthy();
  });

  it.each([
    [100, 0],
    [42, 58],
    [0, 100],
  ])(
    'derives stinkiness %s from cleanliness as %s',
    (cleanliness, expected) => {
      expect(getStinkiness(cleanliness)).toBe(expected);
    },
  );
});
