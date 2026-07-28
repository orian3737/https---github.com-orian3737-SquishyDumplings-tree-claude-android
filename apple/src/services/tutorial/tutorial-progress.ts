import type { KeyValueStore } from '@/services/storage/key-value-store';

export const HABITAT_TUTORIAL_STORAGE_KEY =
  'squishy-dumplings.habitat-tutorial.v1.complete';

export type TutorialProgressRepository = Readonly<{
  isComplete(): Promise<boolean>;
  complete(): Promise<void>;
}>;

/**
 * Tutorial progress deliberately lives outside the pet snapshot. Resetting or
 * repairing care state must not unexpectedly replay onboarding.
 */
export function createTutorialProgressRepository(
  store: KeyValueStore,
): TutorialProgressRepository {
  return {
    isComplete: async () =>
      (await store.getItem(HABITAT_TUTORIAL_STORAGE_KEY)) === 'true',
    complete: async () => {
      await store.setItem(HABITAT_TUTORIAL_STORAGE_KEY, 'true');
    },
  };
}
