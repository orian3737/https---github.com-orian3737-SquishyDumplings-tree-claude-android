import type { CareAction } from './care';
import { createUuidV4 } from './ids';
import type { Pet } from './pet';
import type { RandomSource } from './random';

/**
 * Storage boundaries for the one dumpling.
 *
 * These interfaces deliberately do not say whether a value lives on device or in
 * Supabase. PR 3 supplies a local implementation, PR 7 adds the remote adapter
 * and the queue drain, and neither changes this contract. UI components never
 * talk to a repository directly — feature hooks do (BUILD_SPEC section 4).
 *
 * `loadPet` returning `Pet | null` rather than a list is the type-level half of
 * the one-dumpling invariant: there is no shape here that can hold two pets.
 */
export type PetRepository = {
  /** The owner's dumpling, or null when they have never hatched one. */
  loadPet(): Promise<Pet | null>;
  /** Writes the snapshot for the same dumpling. Never inserts a second one. */
  savePet(pet: Pet): Promise<void>;
  /** Drops cached pet state, for sign-out and account deletion (FR-2). */
  clearPet(): Promise<void>;
};

/**
 * One care action the player performed, queued so it survives a failed sync
 * (FR-5, FR-10). `id` is the client-generated idempotency key from BUILD_SPEC
 * section 5: replaying the same id must apply the effect exactly once.
 */
export type CareEvent = Readonly<{
  id: string;
  petId: string;
  action: CareAction;
  /** When the player acted, from an injected clock. */
  occurredAtMs: number;
}>;

export function createCareEvent(input: {
  petId: string;
  action: CareAction;
  occurredAtMs: number;
  random: RandomSource;
}): CareEvent {
  return {
    id: createUuidV4(input.random),
    petId: input.petId,
    action: input.action,
    occurredAtMs: input.occurredAtMs,
  };
}

/**
 * Pending care writes, in the order the player made them. The queue only stores
 * and releases events; deciding what a retry means is the server's job.
 */
export type CareEventQueue = {
  enqueue(event: CareEvent): Promise<void>;
  /** Oldest first, so replay preserves player intent. */
  pending(): Promise<readonly CareEvent[]>;
  /** Removes an event once the server has confirmed it. */
  acknowledge(eventId: string): Promise<void>;
  clear(): Promise<void>;
};
