import { describe, expect, it } from 'vitest';

import { createTestPet, needs } from './__fixtures__/pet';
import {
  applyCare,
  applyCareToNeeds,
  PROVISIONAL_CARE_TUNING,
  wastedHungerFor,
  willOverfeed,
} from './care';
import { NEED_MAX, NEED_MIN } from './needs';

const tuning = PROVISIONAL_CARE_TUNING;

/**
 * Food is free and unlimited, so overfeeding is never refused. The surplus turns
 * into poop and gives the dumpling a tummy ache instead.
 */
describe('wastedHungerFor', () => {
  it.each([
    [0, 0],
    [40, 0],
    [75, 0],
    [76, 1],
    [90, 15],
    [100, 25],
  ])('hunger %s wastes %s of the feed', (hunger, expected) => {
    expect(wastedHungerFor(needs({ hunger }), tuning)).toBe(expected);
  });

  it('flags an imminent mess so the UI can react', () => {
    expect(
      willOverfeed(createTestPet({ needs: needs({ hunger: 40 }) }), tuning),
    ).toBe(false);
    expect(
      willOverfeed(createTestPet({ needs: needs({ hunger: 95 }) }), tuning),
    ).toBe(true);
  });
});

describe('feeding within appetite', () => {
  it('costs nothing when the dumpling has room', () => {
    expect(
      applyCareToNeeds(needs({ hunger: 40, energy: 50 }), 'feed', tuning),
    ).toEqual(needs({ hunger: 65, energy: 50 + tuning.feedEnergyGain }));
  });

  it('costs nothing at the exact point the feed still fits', () => {
    expect(
      applyCareToNeeds(needs({ hunger: 75, energy: 50 }), 'feed', tuning),
    ).toEqual(needs({ hunger: 100, energy: 50 + tuning.feedEnergyGain }));
  });
});

describe('overfeeding', () => {
  it('still fills the dumpling, but the surplus becomes poop and a tummy ache', () => {
    // Wastes 15: 15 cleanliness becomes poop, and 7 happiness is the ache. The
    // stamina from the meal still lands — the dumpling ate it, it just regrets it.
    expect(
      applyCareToNeeds(needs({ hunger: 90, energy: 50 }), 'feed', tuning),
    ).toEqual(
      needs({
        hunger: 100,
        cleanliness: 65,
        happiness: 73,
        energy: 50 + tuning.feedEnergyGain,
      }),
    );
  });

  it('punishes stuffing a completely full dumpling hardest', () => {
    const result = applyCareToNeeds(needs({ hunger: 100 }), 'feed', tuning);

    expect(result.hunger).toBe(NEED_MAX);
    expect(result.cleanliness).toBe(55);
    expect(result.happiness).toBe(68);
  });

  it('scales with the waste rather than snapping at a threshold', () => {
    const slight = applyCareToNeeds(needs({ hunger: 80 }), 'feed', tuning);
    const heavy = applyCareToNeeds(needs({ hunger: 100 }), 'feed', tuning);

    expect(slight.cleanliness).toBeGreaterThan(heavy.cleanliness);
    expect(slight.happiness).toBeGreaterThan(heavy.happiness);
  });

  it('never refuses the food', () => {
    const pet = createTestPet({ needs: needs({ hunger: NEED_MAX }) });
    const fed = applyCare(pet, {
      action: 'feed',
      atMs: pet.lastCaredAtMs + 1_000,
      tuning,
    });

    expect(fed).not.toBe(pet);
    expect(fed.revision).toBe(pet.revision + 1);
  });

  it('cannot drive cleanliness or happiness out of range, however hard it is spammed', () => {
    let pet = createTestPet({ needs: needs({ hunger: NEED_MAX }) });

    for (let feed = 0; feed < 40; feed += 1) {
      pet = applyCare(pet, {
        action: 'feed',
        atMs: pet.lastCaredAtMs + 1_000,
        tuning,
      });
    }

    for (const value of Object.values(pet.needs)) {
      expect(value).toBeGreaterThanOrEqual(NEED_MIN);
      expect(value).toBeLessThanOrEqual(NEED_MAX);
    }
    expect(pet.needs.cleanliness).toBe(NEED_MIN);
    expect(pet.needs.happiness).toBe(NEED_MIN);
  });

  it('respects injected tuning rather than a hard-coded penalty', () => {
    const result = applyCareToNeeds(
      needs({ hunger: 100, energy: 100 }),
      'feed',
      {
        ...tuning,
        overfeedCleanlinessPenaltyPerWastedPoint: 0,
        overfeedHappinessPenaltyPerWastedPoint: 0,
      },
    );

    expect(result).toEqual(needs({ hunger: 100, energy: 100 }));
  });
});
