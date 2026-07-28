/**
 * Time is injected everywhere in the domain so decay, death grace, and coin
 * eligibility can be tested without sleeping and so server time can override
 * device time once the app is connected.
 */
export type Clock = {
  /** Milliseconds since the Unix epoch. */
  now(): number;
};

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** A clock pinned to one instant. Useful for deterministic tests and replays. */
export function fixedClock(epochMs: number): Clock {
  return { now: () => epochMs };
}

/**
 * A clock the caller can move forward by hand. Tests advance virtual time
 * instead of waiting on real time.
 */
export function createAdvanceableClock(startEpochMs: number): Clock & {
  advanceMinutes(minutes: number): void;
  advanceMs(ms: number): void;
} {
  let current = startEpochMs;

  return {
    now: () => current,
    advanceMs: (ms: number) => {
      current += ms;
    },
    advanceMinutes: (minutes: number) => {
      current += Math.round(minutes * MS_PER_MINUTE);
    },
  };
}

export const MS_PER_MINUTE = 60_000;
