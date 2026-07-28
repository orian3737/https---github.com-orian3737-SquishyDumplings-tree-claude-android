import { MS_PER_MINUTE } from './clock';
import { clampNeed, type Needs } from './needs';
import { withRevision, type Pet } from './pet';
import type { RandomSource } from './random';

/**
 * Messes owed by meals that have not landed yet.
 *
 * A meal does not dirty the habitat the moment it is swallowed. It schedules a
 * mess for some minutes later, and that schedule is stored on the `Pet` rather
 * than held in a timer, so it survives the app being backgrounded, killed, or
 * left closed overnight. A pile the player never saw arrive is exactly what
 * should be waiting for them when they come back.
 *
 * Cleanliness remains the single source of truth for how many piles exist. This
 * module only decides *when* a meal converts into a cleanliness loss; the habitat
 * still derives the visible piles from cleanliness through `hygiene.ts`.
 */
export type MessConfig = Readonly<{
  /** Soonest a meal can come back out, in minutes. */
  minDelayMinutes: number;
  /** Latest a meal can come back out, in minutes. */
  maxDelayMinutes: number;
  /** Cleanliness lost when one scheduled mess lands. */
  cleanlinessPerMess: number;
}>;

/**
 * PROVISIONAL. The delay window and the per-mess cost are both unapproved
 * tuning: they set how often the player is asked to clean, and the poop-density
 * curve they feed into is still an open product decision (BUILD_SPEC section 14).
 *
 * `cleanlinessPerMess` deliberately matches `cleanlinessPerPile` so one meal
 * produces one pile. Decoupling them is possible but wants device eyes first.
 */
export const PROVISIONAL_MESS_CONFIG: MessConfig = {
  minDelayMinutes: 8,
  maxDelayMinutes: 22,
  cleanlinessPerMess: 20,
};

/** Whole minutes of delay for one meal, drawn from the injected source. */
export function messDelayMinutes(
  random: RandomSource,
  config: MessConfig,
): number {
  const min = Math.max(
    0,
    Math.min(config.minDelayMinutes, config.maxDelayMinutes),
  );
  const max = Math.max(
    0,
    Math.max(config.minDelayMinutes, config.maxDelayMinutes),
  );

  return Math.round(min + random.next() * (max - min));
}

/**
 * Records that a meal was eaten, scheduling the mess it will produce.
 *
 * The list is kept sorted so the elapsed-time walk in `decay.ts` can consume it
 * in order without re-sorting on every catch-up.
 */
export function scheduleMess(
  pet: Pet,
  input: Readonly<{ atMs: number; random: RandomSource; config: MessConfig }>,
): Pet {
  if (!Number.isFinite(input.atMs)) {
    return pet;
  }

  const dueAtMs =
    input.atMs + messDelayMinutes(input.random, input.config) * MS_PER_MINUTE;

  return withRevision(pet, {
    pendingMessesAtMs: [...pet.pendingMessesAtMs, dueAtMs].sort(
      (a, b) => a - b,
    ),
  });
}

/** Scheduled messes that have come due by `atMs`, in the order they land. */
export function dueMessesAt(
  pending: readonly number[],
  atMs: number,
): readonly number[] {
  return pending.filter((dueAtMs) => dueAtMs <= atMs).sort((a, b) => a - b);
}

/** Scheduled messes still in the future at `atMs`. */
export function pendingMessesAfter(
  pending: readonly number[],
  atMs: number,
): readonly number[] {
  return pending.filter((dueAtMs) => dueAtMs > atMs);
}

/** Cleanliness after one scheduled mess lands. */
export function needsAfterMess(needs: Needs, config: MessConfig): Needs {
  return {
    ...needs,
    cleanliness: clampNeed(needs.cleanliness - config.cleanlinessPerMess),
  };
}

/**
 * Normalises a stored schedule. Non-finite entries are dropped rather than
 * carried, because one bad timestamp would otherwise sit in the list forever
 * being neither due nor pending.
 */
export function normalizePendingMesses(
  pending: readonly number[],
): readonly number[] {
  return pending
    .filter((entry) => Number.isFinite(entry))
    .sort((a, b) => a - b);
}
