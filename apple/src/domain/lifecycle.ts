/**
 * Lifecycle status for the single dumpling, matching the `pets.lifecycle_status`
 * column proposed in BUILD_SPEC section 5.
 *
 * PR 2 only models and persists the status. The thresholds, grace period,
 * warning sequence, and revival flow that move a pet between these values are
 * PR 5 work and depend on product decisions that are still open (BUILD_SPEC
 * section 14 item 8).
 */
export const LIFECYCLE_STATUSES = ['alive', 'dead', 'reviving'] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export function isLifecycleStatus(value: unknown): value is LifecycleStatus {
  return (
    typeof value === 'string' &&
    (LIFECYCLE_STATUSES as readonly string[]).includes(value)
  );
}

export function isAlive(status: LifecycleStatus): boolean {
  return status === 'alive';
}
