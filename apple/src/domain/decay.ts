import { MS_PER_MINUTE } from './clock';
import { poopPileCount, type HygieneConfig } from './hygiene';
import { dueMessesAt, pendingMessesAfter, type MessConfig } from './messes';
import { clampNeed, type Needs } from './needs';
import { withRevision, type Pet } from './pet';
import { isAsleepAt, type LocalTime } from './sleep-schedule';

/**
 * What elapsed time does to the dumpling.
 *
 * Needs reflect elapsed time rather than a continuous background timer (FR-7),
 * so this module turns "how long since we last looked" into a needs delta.
 *
 * Three things make this more than a subtraction:
 *
 * 1. **Energy recovers, it does not decay.** Energy is stamina, not a need the
 *    player can fail at — it is spent by rubbing and refilled by eating and
 *    resting. Making it a gain here is what stops the dumpling from ratcheting
 *    down into a permanent sleep it can never wake from.
 * 2. **Cleanliness is not on a clock at all.** The habitat gets dirty because
 *    the dumpling ate, not because time passed, so cleanliness moves only
 *    through `messes.ts` and scrubbing.
 * 3. **Messes drag happiness while they sit there**, so the window has to be
 *    walked in segments rather than billed in one multiplication — a mess that
 *    landed three hours into an overnight absence should cost three hours less
 *    than one that landed immediately.
 *
 * Rates and the offline cap are INJECTED. BUILD_SPEC section 14 item 2 lists the
 * real schedule and catch-up cap as an open product decision, so
 * `PROVISIONAL_DECAY_CONFIG` exists to make the app runnable and is not approved
 * tuning.
 */
export type DecayRates = Readonly<{
  hungerPerMinute: number;
  happinessPerMinute: number;
  /**
   * Extra happiness lost per minute for each mess in the habitat. This is the
   * cost of leaving the room dirty, and it is what makes cleaning worth doing
   * beyond unblocking affection.
   */
  happinessPerMinutePerMess: number;
  /**
   * Energy regained per minute of rest. A GAIN, not a loss — see the note above.
   * Deliberately named so no caller can mistake it for a drain.
   */
  energyRecoveryPerMinute: number;
}>;

export type DecayConfig = Readonly<{
  rates: DecayRates;
  /**
   * The most elapsed time a single catch-up may bill for. Stops a user who
   * returns after a week from facing an unrecoverable pet (FR-7).
   */
  offlineCatchUpCapMinutes: number;
}>;

/**
 * PROVISIONAL — playtest values, not an approved schedule.
 *
 * Paced for a player who checks in a couple of times a day, not one who watches the
 * bars move. These rates only run while the dumpling is awake — its quiet window is
 * stasis, so a night costs nothing at all (see `sleep-schedule.ts`).
 *
 * Hunger at 0.15 empties a full dumpling in about eleven waking hours. The target
 * was that a workday leaves it clearly hungry without leaving it starving: eight
 * hours out costs 72 of 100, so the player comes home needed rather than punished.
 * The earlier 2 per minute emptied it in fifty flat minutes, and even 0.2 drained a
 * full dumpling to zero across a single working day.
 *
 * Happiness decays slowly on its own — it is meant to be driven by messes and
 * petting, not by the clock. Three piles roughly quadruple the drain, which is what
 * makes cleaning urgent when there is no meter to show it.
 *
 * Energy still recovers at 1 per minute, awake or asleep. It is stamina, and it is
 * meant to come back inside a single session.
 */
export const PROVISIONAL_DECAY_RATES: DecayRates = {
  hungerPerMinute: 0.15,
  happinessPerMinute: 0.1,
  happinessPerMinutePerMess: 0.1,
  energyRecoveryPerMinute: 1,
};

/** PROVISIONAL — see the note above. Replace once product owners approve rates. */
export const PROVISIONAL_DECAY_CONFIG: DecayConfig = {
  rates: PROVISIONAL_DECAY_RATES,
  offlineCatchUpCapMinutes: 12 * 60,
};

export type ElapsedDecay = Readonly<{
  needs: Needs;
  /** Minutes actually billed, after clamping and capping. */
  appliedMinutes: number;
  /** Minutes discarded because the catch-up cap was hit. */
  forgivenMinutes: number;
  wasCapped: boolean;
  /** True when the later timestamp preceded the earlier one. */
  wasClockSkewed: boolean;
}>;

/**
 * Whole minutes between two instants. A negative span means the device clock
 * moved backwards, which yields 0 rather than a need increase.
 */
export function elapsedMinutesBetween(fromMs: number, toMs: number): number {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return 0;
  }

  const spanMs = toMs - fromMs;
  if (spanMs <= 0) {
    return 0;
  }

  return Math.floor(spanMs / MS_PER_MINUTE);
}

/**
 * Applies the rates for a whole number of minutes at a constant mess count.
 *
 * Changes are floored so a fractional rate matches the Android integer-division
 * reference (0.5 per minute costs 1 point after two minutes, not a rounded 1
 * after one) and so neither decay nor recovery can overshoot its rate.
 */
export function decayNeeds(
  needs: Needs,
  minutes: number,
  rates: DecayRates,
  messCount = 0,
): Needs {
  if (minutes <= 0) {
    return needs;
  }

  const happinessRate =
    rates.happinessPerMinute +
    Math.max(0, messCount) * rates.happinessPerMinutePerMess;

  return {
    hunger: clampNeed(
      needs.hunger - Math.floor(minutes * rates.hungerPerMinute),
    ),
    // Not on a clock: only meals and scrubbing move cleanliness.
    cleanliness: clampNeed(needs.cleanliness),
    energy: clampNeed(
      needs.energy + Math.floor(minutes * rates.energyRecoveryPerMinute),
    ),
    happiness: clampNeed(needs.happiness - Math.floor(minutes * happinessRate)),
  };
}

/**
 * Bills decay for the span between two timestamps, honoring the catch-up cap and
 * refusing to reward a backwards clock. Every returned need stays within 0–100.
 *
 * This is the flat form, with no scheduled messes to account for. `advancePet`
 * is what the app calls; this stays exported because it is the piece worth
 * testing in isolation.
 */
export function applyElapsedDecay(
  needs: Needs,
  input: Readonly<{
    fromMs: number;
    toMs: number;
    config: DecayConfig;
    messCount?: number;
  }>,
): ElapsedDecay {
  const rawMinutes = elapsedMinutesBetween(input.fromMs, input.toMs);
  const wasClockSkewed = input.toMs < input.fromMs;
  const cap = Math.max(0, input.config.offlineCatchUpCapMinutes);
  const appliedMinutes = Math.min(rawMinutes, cap);

  return {
    needs: decayNeeds(
      needs,
      appliedMinutes,
      input.config.rates,
      input.messCount ?? 0,
    ),
    appliedMinutes,
    forgivenMinutes: rawMinutes - appliedMinutes,
    wasCapped: rawMinutes > cap,
    wasClockSkewed,
  };
}

export type AdvanceConfig = Readonly<{
  decay: DecayConfig;
  hygiene: HygieneConfig;
  mess: MessConfig;
  /** Reads wall-clock local time, so the quiet window can be located. */
  localTime: LocalTime;
}>;

export type AdvanceResult = Readonly<{
  pet: Pet;
  /** Scheduled messes that landed during this catch-up. */
  messesLanded: number;
  /** Minutes billed, after the offline cap. Includes time spent asleep. */
  appliedMinutes: number;
  /** Of those, the minutes the dumpling was actually awake and losing needs. */
  awakeMinutes: number;
  forgivenMinutes: number;
  wasCapped: boolean;
  wasClockSkewed: boolean;
}>;

/**
 * Brings the dumpling up to date with the wall clock.
 *
 * The window is walked a minute at a time, accumulating counters, because three
 * things vary across it and none of them can be billed in one multiplication:
 *
 * - **Sleep.** Hunger and happiness stop inside the quiet window, so only awake
 *   minutes count toward them. Energy recovers throughout — that is what sleep is
 *   for.
 * - **Messes.** The per-mess happiness penalty depends on how many piles were
 *   present *during* each stretch of time. Billing the whole window at the final
 *   count would punish a player for messes that landed at the very end; billing at
 *   the starting count would let an overnight mess cost nothing.
 * - **The pile count itself**, which is a step function of cleanliness and so
 *   changes as each mess lands.
 *
 * Rates are applied ONCE at the end, against the accumulated totals. Applying them
 * per minute would floor each step independently, and a rate below 1 per minute
 * would then floor to zero every single time and never move the need at all.
 *
 * Returns the same dumpling — identity, wardrobe, and birth time are preserved by
 * `withRevision`, so a catch-up can never produce a second pet.
 */
export function advancePet(
  pet: Pet,
  toMs: number,
  config: AdvanceConfig,
): AdvanceResult {
  const rawMinutes = elapsedMinutesBetween(pet.lastCaredAtMs, toMs);
  const wasClockSkewed = toMs < pet.lastCaredAtMs;
  const cap = Math.max(0, config.decay.offlineCatchUpCapMinutes);
  const appliedMinutes = Math.min(rawMinutes, cap);
  const forgivenMinutes = rawMinutes - appliedMinutes;

  // Honour the cap by moving the start forward rather than by truncating the
  // total, so the walk stays aligned with real timestamps and real local hours.
  const fromMs = toMs - appliedMinutes * MS_PER_MINUTE;

  const landing = dueMessesAt(pet.pendingMessesAtMs, toMs);
  const rates = config.decay.rates;

  let cleanliness = clampNeed(pet.needs.cleanliness);
  let messesLanded = 0;
  let awakeMinutes = 0;
  /** Integral of pile count over awake time — the mess half of the penalty. */
  let awakeMessMinutes = 0;

  // Messes due before the billable window still land. The cap forgives the wait,
  // not the pile: the player should not be able to skip a mess by staying away.
  let nextLanding = 0;
  while (
    nextLanding < landing.length &&
    (landing[nextLanding] as number) < fromMs
  ) {
    cleanliness = clampNeed(cleanliness - config.mess.cleanlinessPerMess);
    messesLanded += 1;
    nextLanding += 1;
  }

  for (let minute = 0; minute < appliedMinutes; minute += 1) {
    const atMs = fromMs + minute * MS_PER_MINUTE;

    // Land anything due by the start of this minute, so a mess costs the player
    // from the moment it appears rather than from the following minute.
    while (
      nextLanding < landing.length &&
      (landing[nextLanding] as number) <= atMs
    ) {
      cleanliness = clampNeed(cleanliness - config.mess.cleanlinessPerMess);
      messesLanded += 1;
      nextLanding += 1;
    }

    if (isAsleepAt(pet.sleepSchedule, atMs, config.localTime)) {
      continue;
    }

    awakeMinutes += 1;
    awakeMessMinutes += poopPileCount(cleanliness, config.hygiene);
  }

  // Anything still due lands at the very end, costing cleanliness but no time.
  while (nextLanding < landing.length) {
    cleanliness = clampNeed(cleanliness - config.mess.cleanlinessPerMess);
    messesLanded += 1;
    nextLanding += 1;
  }

  const needs: Needs = {
    hunger: clampNeed(
      pet.needs.hunger - Math.floor(awakeMinutes * rates.hungerPerMinute),
    ),
    cleanliness,
    // Recovers while asleep too, which is the whole point of a night's rest.
    energy: clampNeed(
      pet.needs.energy +
        Math.floor(appliedMinutes * rates.energyRecoveryPerMinute),
    ),
    happiness: clampNeed(
      pet.needs.happiness -
        Math.floor(
          awakeMinutes * rates.happinessPerMinute +
            awakeMessMinutes * rates.happinessPerMinutePerMess,
        ),
    ),
  };

  const pendingMessesAtMs = pendingMessesAfter(pet.pendingMessesAtMs, toMs);
  const unchanged =
    needs.hunger === pet.needs.hunger &&
    needs.cleanliness === pet.needs.cleanliness &&
    needs.energy === pet.needs.energy &&
    needs.happiness === pet.needs.happiness &&
    messesLanded === 0 &&
    pendingMessesAtMs.length === pet.pendingMessesAtMs.length &&
    appliedMinutes === 0;

  return {
    pet: unchanged
      ? pet
      : withRevision(pet, {
          needs,
          pendingMessesAtMs,
          lastCaredAtMs: Math.max(pet.lastCaredAtMs, toMs),
        }),
    messesLanded,
    appliedMinutes,
    awakeMinutes,
    forgivenMinutes,
    wasCapped: rawMinutes > cap,
    wasClockSkewed,
  };
}
