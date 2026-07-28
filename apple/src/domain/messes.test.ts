import { describe, expect, it } from 'vitest';

import { createTestPet, needs } from './__fixtures__/pet';
import { MS_PER_MINUTE } from './clock';
import {
  dueMessesAt,
  messDelayMinutes,
  needsAfterMess,
  normalizePendingMesses,
  pendingMessesAfter,
  PROVISIONAL_MESS_CONFIG,
  scheduleMess,
} from './messes';
import { createSeededRandom, type RandomSource } from './random';

const config = PROVISIONAL_MESS_CONFIG;
const START_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const at = (minutes: number) => START_MS + minutes * MS_PER_MINUTE;

/** A source pinned to one value, for asserting the ends of the delay window. */
const fixedRandom = (value: number): RandomSource => ({ next: () => value });

describe('messDelayMinutes', () => {
  it('draws the minimum at the bottom of the range', () => {
    expect(messDelayMinutes(fixedRandom(0), config)).toBe(
      config.minDelayMinutes,
    );
  });

  it('draws the maximum at the top of the range', () => {
    expect(messDelayMinutes(fixedRandom(0.999999), config)).toBe(
      config.maxDelayMinutes,
    );
  });

  it('stays inside the configured window across a long run', () => {
    const random = createSeededRandom(7);

    for (let index = 0; index < 500; index += 1) {
      const delay = messDelayMinutes(random, config);
      expect(delay).toBeGreaterThanOrEqual(config.minDelayMinutes);
      expect(delay).toBeLessThanOrEqual(config.maxDelayMinutes);
      expect(Number.isInteger(delay)).toBe(true);
    }
  });

  it('survives a config with its bounds the wrong way round', () => {
    const delay = messDelayMinutes(fixedRandom(0.5), {
      ...config,
      minDelayMinutes: 30,
      maxDelayMinutes: 10,
    });

    expect(delay).toBeGreaterThanOrEqual(10);
    expect(delay).toBeLessThanOrEqual(30);
  });
});

describe('scheduleMess', () => {
  it('records the mess in the future, never immediately', () => {
    const pet = createTestPet();
    const result = scheduleMess(pet, {
      atMs: START_MS,
      random: fixedRandom(0),
      config,
    });

    expect(result.pendingMessesAtMs).toHaveLength(1);
    expect(result.pendingMessesAtMs[0]).toBeGreaterThan(START_MS);
  });

  it('keeps the schedule sorted however the meals arrive', () => {
    const random = createSeededRandom(3);
    let pet = createTestPet();

    for (const minute of [0, 40, 5, 90, 12]) {
      pet = scheduleMess(pet, { atMs: at(minute), random, config });
    }

    const sorted = [...pet.pendingMessesAtMs].sort((a, b) => a - b);
    expect(pet.pendingMessesAtMs).toEqual(sorted);
  });

  it('preserves identity, so a meal can never produce a second dumpling', () => {
    const pet = createTestPet();
    const result = scheduleMess(pet, {
      atMs: START_MS,
      random: fixedRandom(0.5),
      config,
    });

    expect(result.id).toBe(pet.id);
    expect(result.bornAtMs).toBe(pet.bornAtMs);
    expect(result.revision).toBe(pet.revision + 1);
  });

  it('ignores a non-finite timestamp rather than poisoning the schedule', () => {
    const pet = createTestPet();
    const result = scheduleMess(pet, {
      atMs: Number.NaN,
      random: fixedRandom(0.5),
      config,
    });

    expect(result).toBe(pet);
  });
});

describe('dueMessesAt and pendingMessesAfter', () => {
  const pending = [at(5), at(10), at(30)];

  it('splits the schedule at the current instant', () => {
    expect(dueMessesAt(pending, at(10))).toEqual([at(5), at(10)]);
    expect(pendingMessesAfter(pending, at(10))).toEqual([at(30)]);
  });

  it('treats a mess due exactly now as landed', () => {
    expect(dueMessesAt([at(10)], at(10))).toEqual([at(10)]);
    expect(pendingMessesAfter([at(10)], at(10))).toEqual([]);
  });

  it('accounts for every entry exactly once', () => {
    const nowMs = at(12);
    expect(
      dueMessesAt(pending, nowMs).length +
        pendingMessesAfter(pending, nowMs).length,
    ).toBe(pending.length);
  });

  it('returns due messes in landing order even from an unsorted list', () => {
    expect(dueMessesAt([at(30), at(5), at(10)], at(30))).toEqual([
      at(5),
      at(10),
      at(30),
    ]);
  });
});

describe('needsAfterMess', () => {
  it('costs exactly the configured cleanliness', () => {
    expect(
      needsAfterMess(needs({ cleanliness: 100 }), config).cleanliness,
    ).toBe(100 - config.cleanlinessPerMess);
  });

  it('clamps at the floor rather than going negative', () => {
    expect(needsAfterMess(needs({ cleanliness: 5 }), config).cleanliness).toBe(
      0,
    );
  });

  it('touches nothing but cleanliness', () => {
    const input = needs();
    const result = needsAfterMess(input, config);

    expect(result.hunger).toBe(input.hunger);
    expect(result.energy).toBe(input.energy);
    expect(result.happiness).toBe(input.happiness);
  });
});

describe('normalizePendingMesses', () => {
  it('sorts the schedule', () => {
    expect(normalizePendingMesses([at(30), at(5), at(10)])).toEqual([
      at(5),
      at(10),
      at(30),
    ]);
  });

  it('drops non-finite entries, which would never be due nor pending', () => {
    expect(
      normalizePendingMesses([at(5), Number.NaN, Number.POSITIVE_INFINITY]),
    ).toEqual([at(5)]);
  });
});
