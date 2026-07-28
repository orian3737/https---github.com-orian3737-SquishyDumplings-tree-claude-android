import type { Pet } from '@/domain';

/**
 * What to do when the device and the server disagree.
 *
 * Care is local-first: the device plays offline and the cloud is a backup and a
 * second-device restore, so the resolution rule has to answer "who cared for this
 * dumpling more recently" rather than "who wrote last". Those are different — a
 * background push can write a stale snapshot after a newer one, and `updated_at`
 * would happily prefer it.
 *
 * `lastCaredAtMs` is the right clock because it only advances when the player
 * actually did something, so it is a claim about the world rather than about the
 * network. It is also already the basis for elapsed decay, so a resolution that
 * preserves it cannot leave the pet owing time twice.
 *
 * The server's `revision` deliberately is NOT the comparison. The
 * `bump_pet_revision` trigger increments it on every write, including a push of
 * older state, so it orders writes and says nothing about which state is better.
 */
export type SyncDecision =
  /** Neither side has a dumpling. Onboarding must run. */
  | Readonly<{ kind: 'needs-hatch' }>
  /** Only the device has one, so the server needs catching up. */
  | Readonly<{ kind: 'push-local'; pet: Pet }>
  /** Only the server has one, or its copy is newer. Take it. */
  | Readonly<{ kind: 'adopt-remote'; pet: Pet }>
  /** Both agree. No write, no churn. */
  | Readonly<{ kind: 'in-sync'; pet: Pet }>
  /**
   * The two sides describe different dumplings.
   *
   * Only reachable when a cache outlived its account — sign-out is supposed to
   * clear it. The server row wins because `pets_one_per_owner` makes it the single
   * truth for this owner, and because adopting can never create a second pet
   * whereas pushing local could orphan the real one.
   */
  | Readonly<{
      kind: 'adopt-remote-different-pet';
      pet: Pet;
      discardedId: string;
    }>;

export function resolveSync(
  local: Pet | null,
  remote: Pet | null,
): SyncDecision {
  if (local === null && remote === null) {
    return { kind: 'needs-hatch' };
  }

  if (local === null) {
    return { kind: 'adopt-remote', pet: remote as Pet };
  }

  if (remote === null) {
    return { kind: 'push-local', pet: local };
  }

  if (local.id !== remote.id) {
    return {
      kind: 'adopt-remote-different-pet',
      pet: remote,
      discardedId: local.id,
    };
  }

  if (local.lastCaredAtMs > remote.lastCaredAtMs) {
    return { kind: 'push-local', pet: local };
  }

  if (remote.lastCaredAtMs > local.lastCaredAtMs) {
    return { kind: 'adopt-remote', pet: remote };
  }

  // Identical care times. Prefer local so an in-sync result never replaces the
  // object the UI is already holding, which would re-render the habitat for
  // nothing on every single sync.
  return { kind: 'in-sync', pet: local };
}

/** True when the decision requires writing to the server. */
export function requiresPush(decision: SyncDecision): boolean {
  return decision.kind === 'push-local';
}

/** The dumpling the app should be showing after this decision, if any. */
export function petAfter(decision: SyncDecision): Pet | null {
  return decision.kind === 'needs-hatch' ? null : decision.pet;
}
