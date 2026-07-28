import { describe, expect, it } from 'vitest';

import { createTestPet, FIXTURE_SKIN_ID, needs } from './__fixtures__/pet';
import {
  deserializePet,
  PET_SNAPSHOT_VERSION,
  serializePet,
} from './serialization';

/** A valid snapshot with one field overridden, for the rejection cases. */
function snapshotWith(petOverrides: Record<string, unknown>) {
  const snapshot = serializePet(createTestPet());
  return {
    version: PET_SNAPSHOT_VERSION,
    pet: { ...snapshot.pet, ...petOverrides },
  };
}

describe('round trip', () => {
  it('restores an identical pet', () => {
    const pet = createTestPet({
      rarity: 'epic',
      evolutionStage: 2,
      needs: needs({ hunger: 12, cleanliness: 99 }),
      personalityTags: ['gentle', 'playful'],
      unlockedSkinIds: [FIXTURE_SKIN_ID, 'skin-chili-crisp'],
      revision: 17,
    });

    const result = deserializePet(serializePet(pet));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pet).toEqual(pet);
    expect(result.repaired).toBe(false);
  });

  it('restores a dead pet with its death timestamp', () => {
    const pet = createTestPet({ lifecycleStatus: 'dead', diedAtMs: 1_700_000 });

    const result = deserializePet(serializePet(pet));

    expect(result.ok && result.pet.lifecycleStatus).toBe('dead');
    expect(result.ok && result.pet.diedAtMs).toBe(1_700_000);
  });

  it('does not alias the original needs object', () => {
    const pet = createTestPet();
    const snapshot = serializePet(pet);

    expect(snapshot.pet.needs).not.toBe(pet.needs);
  });
});

describe('rejection', () => {
  it.each([
    ['null', null],
    ['a string', 'not a snapshot'],
    ['an array', []],
    ['a number', 7],
  ])('rejects %s', (_label, input) => {
    const result = deserializePet(input);

    expect(result.ok).toBe(false);
  });

  it('rejects a snapshot with no version', () => {
    const result = deserializePet({ pet: serializePet(createTestPet()).pet });

    expect(result).toEqual({ ok: false, error: 'snapshot version is missing' });
  });

  it('rejects a future snapshot version rather than guessing its shape', () => {
    const snapshot = serializePet(createTestPet());
    const result = deserializePet({
      ...snapshot,
      version: PET_SNAPSHOT_VERSION + 1,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain(
      'unsupported snapshot',
    );
  });

  it.each([
    ['id', { id: '' }],
    ['name', { name: '   ' }],
    ['rarity', { rarity: 'mythic' }],
    ['lifecycleStatus', { lifecycleStatus: 'sleeping' }],
    ['needs', { needs: { hunger: 10 } }],
    ['needs type', { needs: 'lots' }],
    ['bornAtMs', { bornAtMs: 'yesterday' }],
    ['lastCaredAtMs', { lastCaredAtMs: null }],
    ['equippedSkinId', { equippedSkinId: '' }],
    ['unlockedSkinIds', { unlockedSkinIds: 'skin-a' }],
    ['unlockedSkinIds entries', { unlockedSkinIds: ['skin-a', 3] }],
    ['personalityTags', { personalityTags: null }],
    ['evolutionStage', { evolutionStage: 'two' }],
    ['revision', { revision: undefined }],
    ['diedAtMs', { diedAtMs: 'a while ago' }],
  ])('rejects an invalid %s', (_label, overrides) => {
    const result = deserializePet(snapshotWith(overrides));

    expect(result.ok).toBe(false);
  });
});

describe('repair', () => {
  it('clamps out-of-range needs and reports the repair', () => {
    const result = deserializePet(
      snapshotWith({
        needs: { hunger: -40, cleanliness: 250, energy: 60, happiness: 60 },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pet.needs).toEqual(
      needs({
        hunger: 0,
        cleanliness: 100,
        energy: 60,
        happiness: 60,
      }),
    );
    expect(result.repaired).toBe(true);
  });

  it('caps an evolution stage above the rarity maximum', () => {
    const result = deserializePet(
      snapshotWith({ rarity: 'common', evolutionStage: 9 }),
    );

    expect(result.ok && result.pet.evolutionStage).toBe(2);
    expect(result.ok && result.repaired).toBe(true);
  });

  it('pulls the equipped skin into the wardrobe when it is missing', () => {
    const result = deserializePet(
      snapshotWith({
        equippedSkinId: 'skin-chili-crisp',
        unlockedSkinIds: [FIXTURE_SKIN_ID],
      }),
    );

    expect(result.ok && result.pet.unlockedSkinIds).toEqual([
      'skin-chili-crisp',
      FIXTURE_SKIN_ID,
    ]);
  });

  it('deduplicates the wardrobe', () => {
    const result = deserializePet(
      snapshotWith({
        unlockedSkinIds: [FIXTURE_SKIN_ID, FIXTURE_SKIN_ID, 'skin-chili-crisp'],
      }),
    );

    expect(result.ok && result.pet.unlockedSkinIds).toEqual([
      FIXTURE_SKIN_ID,
      'skin-chili-crisp',
    ]);
    expect(result.ok && result.repaired).toBe(true);
  });

  it('drops personality tags this build does not recognize', () => {
    const result = deserializePet(
      snapshotWith({ personalityTags: ['gentle', 'telepathic'] }),
    );

    expect(result.ok && result.pet.personalityTags).toEqual(['gentle']);
    expect(result.ok && result.repaired).toBe(true);
  });

  it('normalizes a stored name', () => {
    const result = deserializePet(snapshotWith({ name: '  Bao   Bun ' }));

    expect(result.ok && result.pet.name).toBe('Bao Bun');
    expect(result.ok && result.repaired).toBe(true);
  });

  it('floors a negative revision', () => {
    const result = deserializePet(snapshotWith({ revision: -5 }));

    expect(result.ok && result.pet.revision).toBe(0);
  });

  it('treats an absent diedAtMs as alive-with-no-death rather than failing', () => {
    const result = deserializePet(snapshotWith({ diedAtMs: undefined }));

    expect(result.ok && result.pet.diedAtMs).toBeNull();
  });
});
