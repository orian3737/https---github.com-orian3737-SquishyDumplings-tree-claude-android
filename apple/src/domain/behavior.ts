import { type Needs } from './needs';
import type { RandomSource } from './random';

/**
 * Ambient behavior, ported from the Android `BehaviorGraph` reference.
 *
 * The Android version was a stateful class that held `lastBehavior`. Here the
 * picker is pure and the caller passes the previous behavior back in, so the
 * whole pool is testable without constructing a picker or mutating shared state.
 *
 * FR-9 fixes the pool, the no-immediate-repeat rule, the forbidden transitions,
 * and the stat biasing. Reduce Motion substitution is a rendering concern and is
 * handled above this layer.
 */
export const BEHAVIORS = [
  'idle-sit',
  'stretch',
  'look-around',
  'yawn',
  'nap',
  'waddle-left',
  'waddle-right',
  'pace',
  'sprint',
  'peek-over-edge',
  'hop-trick',
  'wobble',
  'tongue-out',
  'wave',
  'squat',
] as const;

export type Behavior = (typeof BEHAVIORS)[number];

export type BehaviorDefinition = Readonly<{
  behavior: Behavior;
  durationMs: number;
  baseWeight: number;
}>;

export const BEHAVIOR_TABLE: Readonly<Record<Behavior, BehaviorDefinition>> = {
  'idle-sit': { behavior: 'idle-sit', durationMs: 2500, baseWeight: 3 },
  stretch: { behavior: 'stretch', durationMs: 1800, baseWeight: 1.5 },
  'look-around': { behavior: 'look-around', durationMs: 2000, baseWeight: 2 },
  yawn: { behavior: 'yawn', durationMs: 1500, baseWeight: 1 },
  nap: { behavior: 'nap', durationMs: 6000, baseWeight: 1.5 },
  'waddle-left': { behavior: 'waddle-left', durationMs: 2200, baseWeight: 2.5 },
  'waddle-right': {
    behavior: 'waddle-right',
    durationMs: 2200,
    baseWeight: 2.5,
  },
  pace: { behavior: 'pace', durationMs: 3500, baseWeight: 2 },
  sprint: { behavior: 'sprint', durationMs: 1200, baseWeight: 0.8 },
  'peek-over-edge': {
    behavior: 'peek-over-edge',
    durationMs: 1800,
    baseWeight: 1.2,
  },
  'hop-trick': { behavior: 'hop-trick', durationMs: 1000, baseWeight: 0.4 },
  wobble: { behavior: 'wobble', durationMs: 900, baseWeight: 0.6 },
  'tongue-out': {
    behavior: 'tongue-out',
    durationMs: 1400,
    baseWeight: 0.8,
  },
  wave: { behavior: 'wave', durationMs: 1700, baseWeight: 0.8 },
  squat: { behavior: 'squat', durationMs: 1200, baseWeight: 0.65 },
};

/**
 * Behaviors that must never immediately follow the key behavior. Avoids jarring
 * transitions such as sprinting straight out of a nap. Anything absent here is
 * unrestricted apart from the no-immediate-repeat rule.
 */
export const FORBIDDEN_FOLLOWING_BEHAVIORS: Readonly<
  Partial<Record<Behavior, readonly Behavior[]>>
> = {
  nap: ['sprint', 'hop-trick', 'waddle-left', 'waddle-right'],
  yawn: ['sprint', 'hop-trick'],
};

export const SLUGGISH_BEHAVIORS: readonly Behavior[] = [
  'nap',
  'yawn',
  'idle-sit',
];

export const PLAYFUL_BEHAVIORS: readonly Behavior[] = [
  'hop-trick',
  'sprint',
  'wobble',
  'tongue-out',
  'wave',
  'squat',
];

/** Bias thresholds and multipliers, ported verbatim from the Android reference. */
export const LOW_ENERGY_THRESHOLD = 35;
export const HIGH_HAPPINESS_THRESHOLD = 75;
export const LOW_HUNGER_THRESHOLD = 25;

const LOW_ENERGY_SLUGGISH_MULTIPLIER = 2.5;
const LOW_ENERGY_PLAYFUL_MULTIPLIER = 0.3;
const HIGH_HAPPINESS_PLAYFUL_MULTIPLIER = 2;
const LOW_HUNGER_IDLE_MULTIPLIER = 1.8;
const LOW_HUNGER_OTHER_MULTIPLIER = 0.7;

/**
 * Behaviors eligible after `lastBehavior`: never an immediate repeat, never a
 * forbidden follow-up. A null `lastBehavior` (first pick) allows the full pool.
 */
export function behaviorCandidates(
  lastBehavior: Behavior | null,
): readonly Behavior[] {
  if (lastBehavior === null) {
    return BEHAVIORS;
  }

  const forbidden = FORBIDDEN_FOLLOWING_BEHAVIORS[lastBehavior] ?? [];

  return BEHAVIORS.filter(
    (behavior) => behavior !== lastBehavior && !forbidden.includes(behavior),
  );
}

/**
 * Low energy and low hunger nudge toward sluggish behaviors; high happiness
 * nudges toward playful ones. Weights are relative, never absolute odds.
 */
export function biasedWeightFor(behavior: Behavior, needs: Needs): number {
  let weight = BEHAVIOR_TABLE[behavior].baseWeight;

  const isSluggish = SLUGGISH_BEHAVIORS.includes(behavior);
  const isPlayful = PLAYFUL_BEHAVIORS.includes(behavior);

  if (needs.energy < LOW_ENERGY_THRESHOLD) {
    if (isSluggish) {
      weight *= LOW_ENERGY_SLUGGISH_MULTIPLIER;
    }
    if (isPlayful) {
      weight *= LOW_ENERGY_PLAYFUL_MULTIPLIER;
    }
  }

  if (needs.happiness > HIGH_HAPPINESS_THRESHOLD && isPlayful) {
    weight *= HIGH_HAPPINESS_PLAYFUL_MULTIPLIER;
  }

  if (needs.hunger < LOW_HUNGER_THRESHOLD) {
    weight *=
      behavior === 'idle-sit'
        ? LOW_HUNGER_IDLE_MULTIPLIER
        : LOW_HUNGER_OTHER_MULTIPLIER;
  }

  return weight;
}

export type PickBehaviorInput = Readonly<{
  lastBehavior: Behavior | null;
  needs: Needs;
  random: RandomSource;
}>;

/**
 * Picks the next ambient behavior by weighted random over the eligible pool, so
 * the same twelve behaviors read as alive rather than as a visible loop.
 */
export function pickNextBehavior(input: PickBehaviorInput): Behavior {
  const candidates = behaviorCandidates(input.lastBehavior);
  const weights = candidates.map((behavior) =>
    biasedWeightFor(behavior, input.needs),
  );
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);

  const lastCandidate = candidates[candidates.length - 1] as Behavior;
  if (totalWeight <= 0) {
    return lastCandidate;
  }

  let roll = input.random.next() * totalWeight;

  for (let index = 0; index < candidates.length; index += 1) {
    roll -= weights[index] as number;
    if (roll < 0) {
      return candidates[index] as Behavior;
    }
  }

  // Only reachable through floating-point drift at the very top of the range.
  return lastCandidate;
}

export function behaviorDurationMs(behavior: Behavior): number {
  return BEHAVIOR_TABLE[behavior].durationMs;
}

export function isBehavior(value: unknown): value is Behavior {
  return (
    typeof value === 'string' &&
    (BEHAVIORS as readonly string[]).includes(value)
  );
}
