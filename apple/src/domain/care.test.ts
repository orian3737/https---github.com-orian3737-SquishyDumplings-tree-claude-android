import { describe, expect, it } from 'vitest';

import { createTestPet, needs } from './__fixtures__/pet';
import {
  applyCare,
  applyCareToNeeds,
  attentionGainFor,
  canApplyCare,
  CARE_ACTIONS,
  isCareAction,
  PROVISIONAL_CARE_TUNING,
  willAnnoy,
} from './care';

const tuning = PROVISIONAL_CARE_TUNING;

describe('applyCareToNeeds', () => {
  it('feeding raises hunger and stamina, because a meal is calories too', () => {
    expect(
      applyCareToNeeds(needs({ hunger: 40, energy: 40 }), 'feed', tuning),
    ).toEqual(
      needs({
        hunger: 40 + tuning.feedHungerGain,
        energy: 40 + tuning.feedEnergyGain,
      }),
    );
  });

  // Overfeeding is covered in overfeeding.test.ts: it is never refused, and the
  // surplus becomes poop plus a tummy ache.

  it('cleaning raises cleanliness only', () => {
    expect(applyCareToNeeds(needs(), 'clean', tuning)).toEqual(
      needs({ cleanliness: 100 }),
    );
  });

  it('attention raises happiness and spends energy', () => {
    expect(
      applyCareToNeeds(needs({ happiness: 50 }), 'attention', tuning),
    ).toEqual(
      needs({
        happiness: 50 + tuning.attentionHappinessGain,
        energy: 80 - tuning.attentionEnergyCost,
      }),
    );
  });

  it('resting raises energy only', () => {
    expect(applyCareToNeeds(needs({ energy: 40 }), 'rest', tuning)).toEqual(
      needs({ energy: 40 + tuning.restEnergyGain }),
    );
  });

  it.each(CARE_ACTIONS)('%s never exceeds the ceiling', (action) => {
    const result = applyCareToNeeds(
      needs({ hunger: 100, cleanliness: 100, energy: 100, happiness: 100 }),
      action,
      tuning,
    );

    for (const value of Object.values(result)) {
      expect(value).toBeLessThanOrEqual(100);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('attention is refused outright rather than part-charged when stamina is short', () => {
    // Energy is stamina: with less than one round in the tank the rub does not
    // happen at all, so neither need moves. Part-charging would drain the last
    // few points for no affection.
    const input = needs({ energy: 3 });
    expect(applyCareToNeeds(input, 'attention', tuning)).toEqual(input);
  });

  it('respects injected tuning instead of hard-coded amounts', () => {
    const result = applyCareToNeeds(needs({ hunger: 10 }), 'feed', {
      ...tuning,
      feedHungerGain: 1,
    });

    expect(result.hunger).toBe(11);
  });
});

describe('applyCare', () => {
  it('advances the revision and the care timestamp for the same pet', () => {
    const pet = createTestPet({ needs: needs({ hunger: 40 }) });
    const cared = applyCare(pet, {
      action: 'feed',
      atMs: pet.lastCaredAtMs + 60_000,
      tuning,
    });

    expect(cared.id).toBe(pet.id);
    expect(cared.revision).toBe(pet.revision + 1);
    expect(cared.lastCaredAtMs).toBe(pet.lastCaredAtMs + 60_000);
    expect(cared.needs.hunger).toBe(65);
  });

  it('never moves the care timestamp backwards on a skewed clock', () => {
    const pet = createTestPet();
    const cared = applyCare(pet, {
      action: 'feed',
      atMs: pet.lastCaredAtMs - 600_000,
      tuning,
    });

    expect(cared.lastCaredAtMs).toBe(pet.lastCaredAtMs);
  });

  it.each(CARE_ACTIONS)('is a no-op on a dead dumpling for %s', (action) => {
    const pet = createTestPet({ lifecycleStatus: 'dead', diedAtMs: 1 });

    expect(canApplyCare(pet)).toBe(false);
    expect(applyCare(pet, { action, atMs: 2, tuning })).toBe(pet);
  });

  it('is allowed while alive', () => {
    expect(canApplyCare(createTestPet())).toBe(true);
  });

  it('does not mutate the input pet', () => {
    const pet = createTestPet({ needs: needs({ hunger: 40 }) });
    applyCare(pet, { action: 'feed', atMs: pet.lastCaredAtMs, tuning });
    expect(pet.needs.hunger).toBe(40);
  });
});

describe('isCareAction', () => {
  it.each([
    ['feed', true],
    ['attention', true],
    ['evolve', false],
    ['revive', false],
  ])('%s -> %s', (value, expected) => {
    expect(isCareAction(value)).toBe(expected);
  });
});

describe('attentionGainFor', () => {
  it.each([
    [0, 20],
    [50, 20],
    [80, 20],
    [85, 15],
    [99, 1],
    [100, 0],
  ])(
    'happiness %s gains %s from a round of attention',
    (happiness, expected) => {
      expect(attentionGainFor(needs({ happiness }), tuning)).toBe(expected);
    },
  );

  it('respects injected tuning rather than a fixed amount', () => {
    expect(
      attentionGainFor(needs({ happiness: 90 }), {
        ...tuning,
        attentionHappinessGain: 5,
      }),
    ).toBe(5);
  });
});

describe('willAnnoy', () => {
  it('is false while petting still helps', () => {
    expect(
      willAnnoy(createTestPet({ needs: needs({ happiness: 99 }) }), tuning),
    ).toBe(false);
  });

  it('is true once affection gain has hit zero', () => {
    expect(
      willAnnoy(createTestPet({ needs: needs({ happiness: 100 }) }), tuning),
    ).toBe(true);
  });

  it('is false on a dumpling that is not alive', () => {
    expect(
      willAnnoy(
        createTestPet({
          diedAtMs: 1,
          lifecycleStatus: 'dead',
          needs: needs({ happiness: 100 }),
        }),
        tuning,
      ),
    ).toBe(false);
  });
});

describe('attention still costs energy when it stops helping', () => {
  it('spends energy even at full happiness, so petting is never free', () => {
    const pet = createTestPet({ needs: needs({ energy: 60, happiness: 100 }) });

    const petted = applyCare(pet, {
      action: 'attention',
      atMs: pet.lastCaredAtMs + 1_000,
      tuning,
    });

    expect(petted.needs.happiness).toBe(100);
    expect(petted.needs.energy).toBe(60 - tuning.attentionEnergyCost);
  });
});
