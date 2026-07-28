import { describe, expect, it } from 'vitest';

import { createTestPet, FIXTURE_SKIN_ID, needs } from './__fixtures__/pet';
import { applyCare, PROVISIONAL_CARE_TUNING } from './care';
import { fixedClock } from './clock';
import { applyElapsedDecay, PROVISIONAL_DECAY_CONFIG } from './decay';
import { evolvePet } from './evolution';
import {
  equipSkin,
  hatchPet,
  renamePet,
  setDiet,
  unlockSkin,
  withPersonalityTags,
  withRevision,
  type Pet,
} from './pet';
import { createSeededRandom } from './random';
import { deserializePet, serializePet } from './serialization';

/**
 * The roadmap invariant: one account has exactly one persistent dumpling, and a
 * skin is only an appearance for it. This suite exercises every operation that
 * returns a `Pet` and asserts none of them can produce a different identity.
 *
 * Add a case here whenever a new Pet-returning operation lands.
 */
const petOperations: readonly { name: string; run: (pet: Pet) => Pet }[] = [
  {
    name: 'applyCare(feed)',
    run: (pet) =>
      applyCare(pet, {
        action: 'feed',
        atMs: pet.lastCaredAtMs + 60_000,
        tuning: PROVISIONAL_CARE_TUNING,
      }),
  },
  {
    name: 'applyCare(attention)',
    run: (pet) =>
      applyCare(pet, {
        action: 'attention',
        atMs: pet.lastCaredAtMs + 60_000,
        tuning: PROVISIONAL_CARE_TUNING,
      }),
  },
  { name: 'evolvePet', run: (pet) => evolvePet(pet) },
  { name: 'renamePet', run: (pet) => renamePet(pet, 'Renamed') },
  { name: 'unlockSkin', run: (pet) => unlockSkin(pet, 'skin-chili-crisp') },
  {
    name: 'equipSkin',
    run: (pet) =>
      equipSkin(unlockSkin(pet, 'skin-chili-crisp'), 'skin-chili-crisp'),
  },
  {
    name: 'withPersonalityTags',
    run: (pet) => withPersonalityTags(pet, ['grumpy']),
  },
  { name: 'setDiet', run: (pet) => setDiet(pet, 'vegan') },
  {
    name: 'applyCare(feed) while overfull',
    run: (pet) =>
      applyCare(
        { ...pet, needs: needs({ hunger: 100 }) },
        {
          action: 'feed',
          atMs: pet.lastCaredAtMs + 60_000,
          tuning: PROVISIONAL_CARE_TUNING,
        },
      ),
  },
  { name: 'withRevision', run: (pet) => withRevision(pet, { needs: needs() }) },
  {
    name: 'decay then care',
    run: (pet) => {
      const decayed = applyElapsedDecay(pet.needs, {
        fromMs: pet.lastCaredAtMs,
        toMs: pet.lastCaredAtMs + 90 * 60_000,
        config: PROVISIONAL_DECAY_CONFIG,
      });

      return withRevision(pet, { needs: decayed.needs });
    },
  },
];

describe('one-dumpling invariant', () => {
  it.each(petOperations)('$name preserves the identity', ({ run }) => {
    const pet = createTestPet({ needs: needs({ hunger: 90, energy: 90 }) });
    const result = run(pet);

    expect(result.id).toBe(pet.id);
    expect(result.bornAtMs).toBe(pet.bornAtMs);
  });

  it.each(petOperations)(
    '$name never drops an unlocked appearance',
    ({ run }) => {
      const pet = unlockSkin(createTestPet(), 'skin-lotus');
      const result = run(pet);

      for (const skinId of pet.unlockedSkinIds) {
        expect(result.unlockedSkinIds).toContain(skinId);
      }
    },
  );

  it.each(petOperations)(
    '$name keeps the equipped skin unlocked',
    ({ run }) => {
      const result = run(createTestPet());

      expect(result.unlockedSkinIds).toContain(result.equippedSkinId);
    },
  );

  it('a full care session still ends on the same dumpling', () => {
    const original = createTestPet();
    let pet = original;

    for (const operation of petOperations) {
      pet = operation.run(pet);
    }

    expect(pet.id).toBe(original.id);
    expect(pet.bornAtMs).toBe(original.bornAtMs);
    expect(pet.unlockedSkinIds).toContain(FIXTURE_SKIN_ID);
  });

  it('hatching is the only way to create a pet, and only once', () => {
    const first = hatchPet({
      existingPet: null,
      name: 'Bao',
      rarity: 'common',
      skinId: FIXTURE_SKIN_ID,
      clock: fixedClock(1_000),
      random: createSeededRandom(5),
    });

    expect(first.outcome).toBe('hatched');
    if (first.outcome !== 'hatched') return;

    const second = hatchPet({
      existingPet: first.pet,
      name: 'Second Pet',
      rarity: 'legendary',
      skinId: 'skin-legendary',
      clock: fixedClock(2_000),
      random: createSeededRandom(6),
    });

    expect(second.outcome).toBe('already-hatched');
    expect(second.outcome === 'already-hatched' && second.pet).toBe(first.pet);
  });

  it('a cache round trip restores the same identity, not a new pet', () => {
    const pet = createTestPet();
    const restored = deserializePet(serializePet(pet));

    expect(restored.ok && restored.pet.id).toBe(pet.id);
    expect(restored.ok && restored.pet.bornAtMs).toBe(pet.bornAtMs);
  });
});
