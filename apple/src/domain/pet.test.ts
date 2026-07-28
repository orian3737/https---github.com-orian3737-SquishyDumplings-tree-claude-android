import { describe, expect, it } from 'vitest';

import {
  createTestPet,
  FIXTURE_BORN_AT_MS,
  FIXTURE_SKIN_ID,
} from './__fixtures__/pet';
import { fixedClock } from './clock';
import { isUuid } from './ids';
import { createInitialNeeds } from './needs';
import {
  canEquipSkin,
  equipSkin,
  hasUnlockedSkin,
  hatchPet,
  isValidPetName,
  MAX_PET_NAME_LENGTH,
  normalizePetName,
  renamePet,
  unlockSkin,
  withPersonalityTags,
  withRevision,
} from './pet';
import { createSeededRandom } from './random';

const hatchInput = {
  existingPet: null,
  name: 'Bao',
  rarity: 'rare',
  skinId: FIXTURE_SKIN_ID,
  clock: fixedClock(FIXTURE_BORN_AT_MS),
  random: createSeededRandom(99),
} as const;

describe('normalizePetName', () => {
  it.each([
    ['  Bao  ', 'Bao'],
    ['Bao   Bun', 'Bao Bun'],
    ['\n\tBao\t', 'Bao'],
    ['', ''],
    ['   ', ''],
  ])('normalizes %o to %o', (input, expected) => {
    expect(normalizePetName(input)).toBe(expected);
  });

  it('strips control characters rather than rendering them', () => {
    expect(normalizePetName('Ba\u0000o\u001f')).toBe('Ba o');
  });

  it('truncates over-long names instead of rejecting them', () => {
    const normalized = normalizePetName('D'.repeat(200));

    expect(normalized).toHaveLength(MAX_PET_NAME_LENGTH);
  });

  it.each([
    ['Bao', true],
    ['   ', false],
    ['\u0000', false],
  ])('isValidPetName(%o) -> %s', (input, expected) => {
    expect(isValidPetName(input)).toBe(expected);
  });
});

describe('hatchPet', () => {
  it('creates one alive dumpling wearing its first skin', () => {
    const result = hatchPet(hatchInput);

    expect(result.outcome).toBe('hatched');
    if (result.outcome !== 'hatched') return;

    const pet = result.pet;
    expect(isUuid(pet.id)).toBe(true);
    expect(pet.name).toBe('Bao');
    expect(pet.rarity).toBe('rare');
    expect(pet.evolutionStage).toBe(0);
    expect(pet.needs).toEqual(createInitialNeeds());
    expect(pet.lifecycleStatus).toBe('alive');
    expect(pet.equippedSkinId).toBe(FIXTURE_SKIN_ID);
    expect(pet.unlockedSkinIds).toEqual([FIXTURE_SKIN_ID]);
    expect(pet.bornAtMs).toBe(FIXTURE_BORN_AT_MS);
    expect(pet.lastCaredAtMs).toBe(FIXTURE_BORN_AT_MS);
    expect(pet.diedAtMs).toBeNull();
    expect(pet.revision).toBe(1);
    expect(pet.personalityTags).toEqual([]);
  });

  it('normalizes the submitted name', () => {
    const result = hatchPet({ ...hatchInput, name: '   Bao   Bun  ' });

    expect(result.outcome === 'hatched' && result.pet.name).toBe('Bao Bun');
  });

  it('rejects a name that normalizes to nothing', () => {
    expect(hatchPet({ ...hatchInput, name: '   ' })).toEqual({
      outcome: 'invalid-name',
      reason: 'empty',
    });
  });

  it('returns the existing dumpling untouched instead of hatching again', () => {
    const existingPet = createTestPet();

    const result = hatchPet({ ...hatchInput, existingPet });

    expect(result.outcome).toBe('already-hatched');
    expect(result.outcome === 'already-hatched' && result.pet).toBe(
      existingPet,
    );
  });

  it('stays idempotent across repeated taps with different names', () => {
    const existingPet = createTestPet();

    for (const name of ['Bao', 'Someone Else', '']) {
      const result = hatchPet({ ...hatchInput, existingPet, name });
      expect(result.outcome).toBe('already-hatched');
      expect(result.outcome === 'already-hatched' && result.pet.id).toBe(
        existingPet.id,
      );
    }
  });
});

describe('withRevision', () => {
  it('bumps the revision', () => {
    const pet = createTestPet();

    expect(withRevision(pet, {}).revision).toBe(pet.revision + 1);
  });

  it('refuses to let a caller rewrite the identity or birth time', () => {
    const pet = createTestPet();

    const tampered = withRevision(pet, {
      id: 'someone-elses-pet',
      bornAtMs: 0,
    });

    expect(tampered.id).toBe(pet.id);
    expect(tampered.bornAtMs).toBe(pet.bornAtMs);
  });
});

describe('renamePet', () => {
  it('renames and bumps the revision', () => {
    const pet = createTestPet();
    const renamed = renamePet(pet, '  Dumpy  ');

    expect(renamed.name).toBe('Dumpy');
    expect(renamed.revision).toBe(pet.revision + 1);
    expect(renamed.id).toBe(pet.id);
  });

  it.each([
    ['an empty name', '   '],
    ['the same name', 'Bao'],
  ])('is a no-op for %s', (_label, input) => {
    const pet = createTestPet();

    expect(renamePet(pet, input)).toBe(pet);
  });
});

describe('wardrobe', () => {
  it('unlocks a new appearance without equipping it', () => {
    const pet = createTestPet();
    const unlocked = unlockSkin(pet, 'skin-chili-crisp');

    expect(unlocked.unlockedSkinIds).toEqual([
      FIXTURE_SKIN_ID,
      'skin-chili-crisp',
    ]);
    expect(unlocked.equippedSkinId).toBe(FIXTURE_SKIN_ID);
    expect(hasUnlockedSkin(unlocked, 'skin-chili-crisp')).toBe(true);
  });

  it.each([
    ['an already-owned skin', FIXTURE_SKIN_ID],
    ['an empty skin id', ''],
  ])('is a no-op when unlocking %s', (_label, skinId) => {
    const pet = createTestPet();

    expect(unlockSkin(pet, skinId)).toBe(pet);
  });

  it('equips an unlocked appearance', () => {
    const pet = unlockSkin(createTestPet(), 'skin-chili-crisp');

    expect(canEquipSkin(pet, 'skin-chili-crisp')).toBe(true);

    const equipped = equipSkin(pet, 'skin-chili-crisp');
    expect(equipped.equippedSkinId).toBe('skin-chili-crisp');
    expect(equipped.unlockedSkinIds).toEqual(pet.unlockedSkinIds);
    expect(equipped.id).toBe(pet.id);
  });

  it('refuses to equip an appearance that was never unlocked', () => {
    const pet = createTestPet();

    expect(canEquipSkin(pet, 'skin-never-rolled')).toBe(false);
    expect(equipSkin(pet, 'skin-never-rolled')).toBe(pet);
  });

  it('refuses to re-equip the appearance already worn', () => {
    const pet = createTestPet();

    expect(canEquipSkin(pet, FIXTURE_SKIN_ID)).toBe(false);
    expect(equipSkin(pet, FIXTURE_SKIN_ID)).toBe(pet);
  });

  it('keeps the equipped skin and the wardrobe intact through a rename', () => {
    const pet = renamePet(
      unlockSkin(createTestPet(), 'skin-chili-crisp'),
      'Dumpy',
    );

    expect(pet.unlockedSkinIds).toEqual([FIXTURE_SKIN_ID, 'skin-chili-crisp']);
    expect(pet.equippedSkinId).toBe(FIXTURE_SKIN_ID);
  });
});

describe('withPersonalityTags', () => {
  it('stores tags in canonical order without duplicates', () => {
    const pet = withPersonalityTags(createTestPet(), [
      'playful',
      'gentle',
      'playful',
    ]);

    expect(pet.personalityTags).toEqual(['gentle', 'playful']);
  });
});
