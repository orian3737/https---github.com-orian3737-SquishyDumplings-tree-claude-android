import type { Pet, PetRepository } from '@/domain';
import type { RemotePetRepository } from '@/services/pet/remote-pet-repository';

import { resolveSync, type SyncDecision } from './sync-policy';

/**
 * One reconciliation between the device and the cloud.
 *
 * Care is local-first, so this is a backup and a restore rather than a
 * transaction. It is deliberately not on the care path: nothing the player does
 * waits for it, and a failure is a retry later, never a blocked action.
 *
 * Split from the React layer so the whole policy plus its failure handling can be
 * exercised against fakes, in Node, with no network.
 */
export type SyncOutcome =
  | Readonly<{ status: 'synced'; decision: SyncDecision; pet: Pet | null }>
  /** The network or the server was unavailable. The device keeps playing. */
  | Readonly<{ status: 'offline'; error: string }>
  /** The dumpling exists locally but has no server row yet. Hatch has not run. */
  | Readonly<{ status: 'awaiting-hatch'; pet: Pet }>;

export async function syncPet(input: {
  local: PetRepository;
  remote: RemotePetRepository;
}): Promise<SyncOutcome> {
  let localPet: Pet | null;
  let remotePet: Pet | null;

  try {
    // Local first and separately: a remote failure must not stop the device from
    // knowing its own dumpling.
    localPet = await input.local.loadPet();
  } catch (error: unknown) {
    return { status: 'offline', error: describe(error) };
  }

  try {
    remotePet = await input.remote.loadRemote();
  } catch (error: unknown) {
    return { status: 'offline', error: describe(error) };
  }

  const decision = resolveSync(localPet, remotePet);

  switch (decision.kind) {
    case 'needs-hatch':
    case 'in-sync':
      return {
        status: 'synced',
        decision,
        pet: decision.kind === 'in-sync' ? decision.pet : null,
      };

    case 'adopt-remote':
    case 'adopt-remote-different-pet': {
      // Write the server's copy into the cache so a later offline launch opens on
      // the right dumpling rather than the one this device last held.
      try {
        await input.local.savePet(decision.pet);
      } catch (error: unknown) {
        return { status: 'offline', error: describe(error) };
      }

      return { status: 'synced', decision, pet: decision.pet };
    }

    case 'push-local': {
      if (remotePet === null) {
        // Nothing to update. Only `hatch_pet` may create the row, so this is the
        // normal state between signing up and hatching, not a failure.
        return { status: 'awaiting-hatch', pet: decision.pet };
      }

      try {
        await input.remote.savePet(decision.pet);
      } catch (error: unknown) {
        return { status: 'offline', error: describe(error) };
      }

      return { status: 'synced', decision, pet: decision.pet };
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
