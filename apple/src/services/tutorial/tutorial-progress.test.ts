import { describe, expect, it } from 'vitest';

import { createInMemoryKeyValueStore } from '@/services/storage/key-value-store';

import {
  createTutorialProgressRepository,
  HABITAT_TUTORIAL_STORAGE_KEY,
} from './tutorial-progress';

describe('habitat tutorial progress', () => {
  it('starts incomplete', async () => {
    const repository = createTutorialProgressRepository(
      createInMemoryKeyValueStore(),
    );

    await expect(repository.isComplete()).resolves.toBe(false);
  });

  it('persists completion independently', async () => {
    const store = createInMemoryKeyValueStore();
    const repository = createTutorialProgressRepository(store);

    await repository.complete();

    await expect(repository.isComplete()).resolves.toBe(true);
    expect(store.snapshot()).toEqual({
      [HABITAT_TUTORIAL_STORAGE_KEY]: 'true',
    });
  });

  it('does not treat unknown stored values as completion', async () => {
    const repository = createTutorialProgressRepository(
      createInMemoryKeyValueStore({
        [HABITAT_TUTORIAL_STORAGE_KEY]: 'not-yet',
      }),
    );

    await expect(repository.isComplete()).resolves.toBe(false);
  });
});
