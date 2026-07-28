import { describe, expect, it } from 'vitest';

import { createTestPet, needs } from './__fixtures__/pet';
import {
  canEvolve,
  EVOLUTION_MOOD_THRESHOLD,
  evolutionBlockedReason,
  evolvePet,
} from './evolution';
import { maxEvolutionStageFor } from './rarity';

const moodOf = (value: number) =>
  needs({
    hunger: value,
    cleanliness: value,
    energy: value,
    happiness: value,
  });

describe('evolutionBlockedReason', () => {
  it('allows evolution exactly at the mood threshold', () => {
    const pet = createTestPet({ needs: moodOf(EVOLUTION_MOOD_THRESHOLD) });

    expect(evolutionBlockedReason(pet)).toBeNull();
    expect(canEvolve(pet)).toBe(true);
  });

  it('blocks one point below the mood threshold', () => {
    const pet = createTestPet({ needs: moodOf(EVOLUTION_MOOD_THRESHOLD - 1) });

    expect(evolutionBlockedReason(pet)).toBe('mood-too-low');
    expect(canEvolve(pet)).toBe(false);
  });

  it('blocks at the rarity maximum stage', () => {
    const pet = createTestPet({
      rarity: 'common',
      evolutionStage: maxEvolutionStageFor('common'),
      needs: moodOf(100),
    });

    expect(evolutionBlockedReason(pet)).toBe('max-stage');
  });

  it.each(['dead', 'reviving'] as const)(
    'blocks while %s',
    (lifecycleStatus) => {
      const pet = createTestPet({ lifecycleStatus, needs: moodOf(100) });

      expect(evolutionBlockedReason(pet)).toBe('not-alive');
    },
  );

  it('reports the lifecycle problem ahead of a low mood', () => {
    const pet = createTestPet({ lifecycleStatus: 'dead', needs: moodOf(0) });

    expect(evolutionBlockedReason(pet)).toBe('not-alive');
  });
});

describe('evolvePet', () => {
  it('advances exactly one stage per eligible call', () => {
    const pet = createTestPet({ needs: moodOf(100) });
    const evolved = evolvePet(pet);

    expect(evolved.evolutionStage).toBe(pet.evolutionStage + 1);
    expect(evolved.revision).toBe(pet.revision + 1);
    expect(evolved.id).toBe(pet.id);
  });

  it('returns the same pet when ineligible, so repeat requests are idempotent', () => {
    const pet = createTestPet({ needs: moodOf(0) });

    expect(evolvePet(pet)).toBe(pet);
    expect(evolvePet(evolvePet(pet))).toBe(pet);
  });

  it.each(['common', 'uncommon', 'rare', 'epic', 'legendary'] as const)(
    'never pushes a %s dumpling past its maximum stage',
    (rarity) => {
      let pet = createTestPet({ rarity, needs: moodOf(100) });

      for (let attempt = 0; attempt < 10; attempt += 1) {
        pet = evolvePet(pet);
      }

      expect(pet.evolutionStage).toBe(maxEvolutionStageFor(rarity));
    },
  );
});
