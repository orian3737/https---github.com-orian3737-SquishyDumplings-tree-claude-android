import { describe, expect, it } from 'vitest';

import { serializePet } from '@/domain';
import { createTestPet } from '@/domain/__fixtures__/pet';
import {
  createInMemoryKeyValueStore,
  type KeyValueStore,
} from '@/services/storage/key-value-store';

import { createPetRepository, PET_STORAGE_KEY } from './pet-repository';

function repositoryWith(seed: Readonly<Record<string, string>> = {}) {
  const store = createInMemoryKeyValueStore(seed);
  return { store, repository: createPetRepository(store) };
}

describe('empty storage', () => {
  it('reports empty rather than an error', async () => {
    const { repository } = repositoryWith();

    expect(await repository.loadPetOutcome()).toEqual({ status: 'empty' });
    expect(await repository.loadPet()).toBeNull();
  });
});

describe('save and load', () => {
  it('round-trips the same dumpling', async () => {
    const pet = createTestPet({ diet: 'vegan', favoriteFood: 'tofu' });
    const { repository } = repositoryWith();

    await repository.savePet(pet);
    const outcome = await repository.loadPetOutcome();

    expect(outcome.status).toBe('loaded');
    if (outcome.status !== 'loaded') return;
    expect(outcome.pet).toEqual(pet);
    expect(outcome.repaired).toBe(false);
  });

  it('writes to the versioned key as JSON', async () => {
    const pet = createTestPet();
    const { store, repository } = repositoryWith();

    await repository.savePet(pet);
    const raw = store.snapshot()[PET_STORAGE_KEY];

    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toEqual(serializePet(pet));
  });

  it('overwrites rather than accumulating pets', async () => {
    const pet = createTestPet();
    const { store, repository } = repositoryWith();

    await repository.savePet(pet);
    await repository.savePet({ ...pet, name: 'Renamed', revision: 2 });

    expect(Object.keys(store.snapshot())).toEqual([PET_STORAGE_KEY]);

    const outcome = await repository.loadPetOutcome();
    expect(outcome.status === 'loaded' && outcome.pet.id).toBe(pet.id);
    expect(outcome.status === 'loaded' && outcome.pet.name).toBe('Renamed');
  });

  it('survives repeated reloads without drifting', async () => {
    const pet = createTestPet();
    const { repository } = repositoryWith();
    await repository.savePet(pet);

    const first = await repository.loadPet();
    const second = await repository.loadPet();

    expect(first).toEqual(second);
    expect(first?.id).toBe(pet.id);
  });

  it('reports a repair without losing the identity', async () => {
    const pet = createTestPet();
    const snapshot = serializePet(pet);
    const { repository } = repositoryWith({
      [PET_STORAGE_KEY]: JSON.stringify({
        ...snapshot,
        pet: { ...snapshot.pet, needs: { ...snapshot.pet.needs, hunger: 900 } },
      }),
    });

    const outcome = await repository.loadPetOutcome();

    expect(outcome.status).toBe('loaded');
    if (outcome.status !== 'loaded') return;
    expect(outcome.repaired).toBe(true);
    expect(outcome.pet.id).toBe(pet.id);
    expect(outcome.pet.needs.hunger).toBe(100);
  });
});

describe('corrupt storage', () => {
  it.each([
    ['not JSON at all', 'this is not json'],
    ['JSON that is not a snapshot', '"just a string"'],
    ['a snapshot with no version', '{"pet":{}}'],
    ['a snapshot with an unusable pet', '{"version":1,"pet":{"id":""}}'],
  ])('reports %s as corrupt, never as empty', async (_label, raw) => {
    const { repository } = repositoryWith({ [PET_STORAGE_KEY]: raw });

    const outcome = await repository.loadPetOutcome();

    expect(outcome.status).toBe('corrupt');
    expect(outcome.status === 'corrupt' && outcome.error).toBeTruthy();
  });

  it('surfaces a storage read failure instead of pretending there is no pet', async () => {
    const failing: KeyValueStore = {
      getItem: async () => {
        throw new Error('disk is on fire');
      },
      setItem: async () => {},
      removeItem: async () => {},
    };

    const outcome = await createPetRepository(failing).loadPetOutcome();

    expect(outcome.status).toBe('corrupt');
    expect(outcome.status === 'corrupt' && outcome.error).toContain(
      'disk is on fire',
    );
  });
});

describe('clearPet', () => {
  it('removes the cached dumpling for sign-out and deletion', async () => {
    const { store, repository } = repositoryWith();
    await repository.savePet(createTestPet());

    await repository.clearPet();

    expect(store.snapshot()).toEqual({});
    expect(await repository.loadPetOutcome()).toEqual({ status: 'empty' });
  });

  it('is safe to call when nothing is stored', async () => {
    const { repository } = repositoryWith();

    await expect(repository.clearPet()).resolves.toBeUndefined();
  });
});
