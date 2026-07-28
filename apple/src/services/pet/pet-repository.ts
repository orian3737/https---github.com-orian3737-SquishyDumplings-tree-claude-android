import {
  deserializePet,
  serializePet,
  type Pet,
  type PetRepository,
} from '@/domain';
import type { KeyValueStore } from '@/services/storage/key-value-store';

/**
 * Local persistence for the one dumpling.
 *
 * The key is versioned so a future incompatible layout can be introduced without
 * colliding with an existing install. Snapshot-internal versioning is separate and
 * lives in the domain's `serializePet`.
 */
export const PET_STORAGE_KEY = 'squishy-dumplings/pet/v1';

/**
 * What a load found.
 *
 * `corrupt` is deliberately distinct from `empty`. Treating unreadable state as "no
 * pet yet" would offer the player a fresh hatch and destroy the dumpling they
 * already had, which is the one-dumpling invariant failing from the player's point
 * of view even though the code is technically consistent. Callers must handle it as
 * an error state. Once PR 7 adds sync, a corrupt local cache becomes recoverable
 * from the server instead of terminal.
 */
export type PetLoadOutcome =
  | Readonly<{ status: 'empty' }>
  | Readonly<{ status: 'loaded'; pet: Pet; repaired: boolean }>
  | Readonly<{ status: 'corrupt'; error: string }>;

export type LocalPetRepository = PetRepository & {
  /** The detailed load the session layer needs to tell empty from corrupt. */
  loadPetOutcome(): Promise<PetLoadOutcome>;
};

export function createPetRepository(store: KeyValueStore): LocalPetRepository {
  async function loadPetOutcome(): Promise<PetLoadOutcome> {
    let raw: string | null;
    try {
      raw = await store.getItem(PET_STORAGE_KEY);
    } catch (error: unknown) {
      return {
        status: 'corrupt',
        error: `storage read failed: ${describeError(error)}`,
      };
    }

    if (raw === null) {
      return { status: 'empty' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error: unknown) {
      return {
        status: 'corrupt',
        error: `stored pet is not valid JSON: ${describeError(error)}`,
      };
    }

    const result = deserializePet(parsed);
    if (!result.ok) {
      return { status: 'corrupt', error: result.error };
    }

    return { status: 'loaded', pet: result.pet, repaired: result.repaired };
  }

  return {
    loadPetOutcome,

    /**
     * The domain-facing contract. Corrupt state reads as absent here, which is why
     * the session layer uses `loadPetOutcome` instead and never offers a fresh
     * hatch on a read failure.
     */
    loadPet: async () => {
      const outcome = await loadPetOutcome();
      return outcome.status === 'loaded' ? outcome.pet : null;
    },

    savePet: async (pet) => {
      await store.setItem(PET_STORAGE_KEY, JSON.stringify(serializePet(pet)));
    },

    clearPet: async () => {
      await store.removeItem(PET_STORAGE_KEY);
    },
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
