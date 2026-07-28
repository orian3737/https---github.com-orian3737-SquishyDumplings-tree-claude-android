import { describe, expect, it } from 'vitest';

import { needs } from './__fixtures__/pet';
import {
  adjustNeed,
  clampNeed,
  clampNeeds,
  createInitialNeeds,
  INITIAL_NEED_VALUE,
  isFullyExhausted,
  isNeedName,
  isNeglected,
  moodOf,
  NEGLECT_THRESHOLD,
  stinkinessOf,
} from './needs';

describe('clampNeed', () => {
  it.each([
    [-10, 0],
    [-0.4, 0],
    [0, 0],
    [41.6, 42],
    [41.4, 41],
    [100, 100],
    [130, 100],
  ])('clamps %s to %s', (input, expected) => {
    expect(clampNeed(input)).toBe(expected);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('treats %s as the minimum rather than propagating it', (_label, input) => {
    expect(clampNeed(input)).toBe(0);
  });
});

describe('clampNeeds', () => {
  it('clamps every need independently', () => {
    expect(
      clampNeeds({
        hunger: -5,
        cleanliness: 250,
        energy: 55.5,
        happiness: Number.NaN,
      }),
    ).toEqual({ hunger: 0, cleanliness: 100, energy: 56, happiness: 0 });
  });
});

describe('adjustNeed', () => {
  it('applies a positive delta and leaves other needs alone', () => {
    expect(adjustNeed(needs(), 'hunger', 15)).toEqual(needs({ hunger: 95 }));
  });

  it('clamps at the ceiling', () => {
    expect(adjustNeed(needs({ hunger: 90 }), 'hunger', 25).hunger).toBe(100);
  });

  it('clamps at the floor', () => {
    expect(adjustNeed(needs({ energy: 5 }), 'energy', -25).energy).toBe(0);
  });

  it('does not mutate its input', () => {
    const original = needs();
    adjustNeed(original, 'hunger', 10);
    expect(original.hunger).toBe(80);
  });
});

describe('moodOf', () => {
  it.each([
    [needs(), 80],
    [needs({ hunger: 70, cleanliness: 70, energy: 70, happiness: 70 }), 70],
    // 281 / 4 = 70.25, and mood floors rather than rounds.
    [needs({ hunger: 70, cleanliness: 70, energy: 70, happiness: 71 }), 70],
    [needs({ hunger: 0, cleanliness: 0, energy: 0, happiness: 3 }), 0],
    [
      needs({ hunger: 100, cleanliness: 100, energy: 100, happiness: 100 }),
      100,
    ],
  ])('averages to %#-> %s', (input, expected) => {
    expect(moodOf(input)).toBe(expected);
  });

  it('uses clamped values so corrupt input cannot inflate mood', () => {
    expect(moodOf(needs({ happiness: 1000 }))).toBe(85);
  });
});

describe('isNeglected', () => {
  it.each([
    [needs({ hunger: NEGLECT_THRESHOLD - 1 }), true],
    [needs({ hunger: NEGLECT_THRESHOLD }), false],
    [needs({ cleanliness: NEGLECT_THRESHOLD - 1 }), true],
    [needs({ cleanliness: NEGLECT_THRESHOLD }), false],
    [needs({ energy: 0, happiness: 0 }), false],
  ])('case %# is %s', (input, expected) => {
    expect(isNeglected(input)).toBe(expected);
  });
});

describe('isFullyExhausted', () => {
  it.each([
    [needs({ energy: -10 }), true],
    [needs({ energy: 0 }), true],
    [needs({ energy: 1 }), false],
    [needs({ energy: 100 }), false],
  ])('case %# is %s', (input, expected) => {
    expect(isFullyExhausted(input)).toBe(expected);
  });
});

describe('stinkinessOf', () => {
  it.each([
    [100, 0],
    [42, 58],
    [0, 100],
  ])(
    'derives stinkiness from cleanliness %s as %s',
    (cleanliness, expected) => {
      expect(stinkinessOf(cleanliness)).toBe(expected);
    },
  );
});

describe('createInitialNeeds', () => {
  it('starts every need at the documented initial value', () => {
    expect(createInitialNeeds()).toEqual({
      hunger: INITIAL_NEED_VALUE,
      cleanliness: INITIAL_NEED_VALUE,
      energy: INITIAL_NEED_VALUE,
      happiness: INITIAL_NEED_VALUE,
    });
  });
});

describe('isNeedName', () => {
  it.each([
    ['hunger', true],
    ['cleanliness', true],
    ['stinkiness', false],
    ['', false],
  ])('%s -> %s', (value, expected) => {
    expect(isNeedName(value)).toBe(expected);
  });
});
