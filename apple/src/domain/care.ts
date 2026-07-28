import { isAlive } from './lifecycle';
import { scheduleMess, type MessConfig } from './messes';
import { adjustNeed, clampNeed, NEED_MAX, type Needs } from './needs';
import { withRevision, type Pet } from './pet';
import type { RandomSource } from './random';

/**
 * The four care actions, matching the `care_events.action` values in BUILD_SPEC
 * section 5. `evolve` and `revive` are separate lifecycle operations, not care.
 */
export const CARE_ACTIONS = ['feed', 'clean', 'attention', 'rest'] as const;

export type CareAction = (typeof CARE_ACTIONS)[number];

/**
 * Care amounts are injected so the approved values live in one configuration
 * rather than being scattered through the engine.
 */
export type CareTuning = Readonly<{
  feedHungerGain: number;
  /**
   * Energy a meal restores. Food is calories: eating is the fast way to refill
   * stamina, and resting over time is the slow way.
   */
  feedEnergyGain: number;
  cleanCleanlinessGain: number;
  attentionHappinessGain: number;
  /**
   * UNRESOLVED. BUILD_SPEC section 6 records the attention energy cost as
   * undecided and section 14 item 10 keeps it an open product decision. The
   * provisional value below mirrors the Android reference, where playing spent
   * half the happiness gain.
   */
  attentionEnergyCost: number;
  restEnergyGain: number;
  /**
   * Cleanliness lost per point of wasted hunger. Food the dumpling cannot absorb
   * comes back out as poop, so overfeeding is self-punishing through the
   * environment rather than through a refusal.
   *
   * PROVISIONAL. Tied to the poop-pile density curve, which is still an open
   * product decision (BUILD_SPEC section 14).
   */
  overfeedCleanlinessPenaltyPerWastedPoint: number;
  /**
   * Happiness lost per point of wasted hunger — the tummy ache. PROVISIONAL for
   * the same reason.
   */
  overfeedHappinessPenaltyPerWastedPoint: number;
}>;

/**
 * Ported from the Android `PetStats` reference and BUILD_SPEC section 6.
 * Every value except `attentionEnergyCost` is the documented MVP number.
 */
export const PROVISIONAL_CARE_TUNING: CareTuning = {
  feedHungerGain: 25,
  feedEnergyGain: 12,
  cleanCleanlinessGain: 35,
  attentionHappinessGain: 20,
  attentionEnergyCost: 10,
  restEnergyGain: 30,
  overfeedCleanlinessPenaltyPerWastedPoint: 1,
  overfeedHappinessPenaltyPerWastedPoint: 0.5,
};

/** Care has no effect on a dumpling that is not alive. Revival is PR 5 work. */
export function canApplyCare(pet: Pet): boolean {
  return isAlive(pet.lifecycleStatus);
}

/**
 * Hunger a feed would produce beyond full, and therefore waste.
 *
 * Nothing refuses food. Overfeeding is always accepted and has consequences
 * instead of a block: the surplus becomes poop and gives the dumpling a tummy
 * ache. Because both penalties scale with this value there is no threshold cliff
 * — feeding a slightly-full dumpling costs a little, stuffing a full one costs a
 * lot, and a hungry dumpling costs nothing.
 */
export function wastedHungerFor(needs: Needs, tuning: CareTuning): number {
  return Math.max(0, needs.hunger + tuning.feedHungerGain - NEED_MAX);
}

/**
 * True when a feed right now would waste food. Callers use this to play the
 * tummy-ache reaction and to warn before a deliberate mess.
 */
export function willOverfeed(pet: Pet, tuning: CareTuning): boolean {
  return wastedHungerFor(pet.needs, tuning) > 0;
}

/**
 * Why a round of attention paid nothing.
 *
 * Three different situations produce a zero gain and they must not look alike to
 * the player — there is no affection meter, so the dumpling's reaction is the
 * only feedback there is. Telling them apart here is what lets the habitat play
 * `dirty`, `sleepy`, or `annoyed` instead of one ambiguous shrug.
 */
export type AttentionBlock = 'none' | 'mess' | 'exhausted' | 'sated';

export type AttentionOutcome = Readonly<{
  happinessGain: number;
  energyCost: number;
  blockedBy: AttentionBlock;
}>;

export type AttentionContext = Readonly<{
  /** Messes currently in the habitat. Any at all and affection does not land. */
  messCount?: number;
}>;

/**
 * What one round of attention would actually do.
 *
 * A dirty habitat blocks affection outright: the dumpling will not settle while
 * it is standing next to its own mess, so cleaning is the prerequisite for
 * petting rather than a parallel chore. Crucially a blocked rub costs **no**
 * energy — charging stamina for an action that cannot pay out would let a
 * confused player rub their dumpling to exhaustion in a dirty room, which is the
 * doom loop this project already rejected for the food economy.
 *
 * Exhaustion blocks it too, and that is the whole point of energy: it is stamina
 * spent on affection, so an empty bar means the session is over until the
 * dumpling has rested or eaten.
 *
 * Being already fully content still costs energy. Pestering a sated dumpling is
 * not free, and `annoyed` is what says so.
 */
export function attentionOutcomeFor(
  needs: Needs,
  tuning: CareTuning,
  context: AttentionContext = {},
): AttentionOutcome {
  if ((context.messCount ?? 0) > 0) {
    return { happinessGain: 0, energyCost: 0, blockedBy: 'mess' };
  }

  if (clampNeed(needs.energy) < tuning.attentionEnergyCost) {
    return { happinessGain: 0, energyCost: 0, blockedBy: 'exhausted' };
  }

  const happinessGain =
    clampNeed(needs.happiness + tuning.attentionHappinessGain) -
    clampNeed(needs.happiness);

  return {
    happinessGain,
    energyCost: tuning.attentionEnergyCost,
    blockedBy: happinessGain === 0 ? 'sated' : 'none',
  };
}

/**
 * The happiness a round of attention would actually add. Thin wrapper over
 * `attentionOutcomeFor` for callers that only need the number.
 */
export function attentionGainFor(
  needs: Needs,
  tuning: CareTuning,
  context: AttentionContext = {},
): number {
  return attentionOutcomeFor(needs, tuning, context).happinessGain;
}

/** True when more petting would add nothing, so the dumpling should say so. */
export function willAnnoy(
  pet: Pet,
  tuning: CareTuning,
  context: AttentionContext = {},
): boolean {
  return (
    canApplyCare(pet) && attentionGainFor(pet.needs, tuning, context) === 0
  );
}

/** The pure needs transition for one care action, with no identity or timestamps. */
export function applyCareToNeeds(
  needs: Needs,
  action: CareAction,
  tuning: CareTuning,
  context: AttentionContext = {},
): Needs {
  switch (action) {
    case 'feed': {
      // A meal is calories as well as a full stomach, so it tops up stamina too.
      const fed = adjustNeed(
        adjustNeed(needs, 'hunger', tuning.feedHungerGain),
        'energy',
        tuning.feedEnergyGain,
      );
      const wasted = wastedHungerFor(needs, tuning);

      if (wasted === 0) {
        return fed;
      }

      // Surplus food becomes poop, and the dumpling gets a tummy ache.
      return adjustNeed(
        adjustNeed(
          fed,
          'cleanliness',
          -Math.floor(wasted * tuning.overfeedCleanlinessPenaltyPerWastedPoint),
        ),
        'happiness',
        -Math.floor(wasted * tuning.overfeedHappinessPenaltyPerWastedPoint),
      );
    }
    case 'clean':
      return adjustNeed(needs, 'cleanliness', tuning.cleanCleanlinessGain);
    case 'attention': {
      // Blocked rubs change nothing at all — see `attentionOutcomeFor`.
      const outcome = attentionOutcomeFor(needs, tuning, context);

      return adjustNeed(
        adjustNeed(needs, 'happiness', outcome.happinessGain),
        'energy',
        -outcome.energyCost,
      );
    }
    case 'rest':
      return adjustNeed(needs, 'energy', tuning.restEnergyGain);
  }
}

export type ApplyCareInput = Readonly<{
  action: CareAction;
  /** When the player performed the action, from an injected clock. */
  atMs: number;
  tuning: CareTuning;
  /** Habitat state the action depends on. Only attention reads it today. */
  context?: AttentionContext;
}>;

/**
 * Applies one care action to the existing dumpling.
 *
 * Always the same pet: identity, wardrobe, and birth time are preserved, and
 * `lastCaredAtMs` moves forward so the next elapsed-decay pass bills from here.
 * A pet that is not alive is returned unchanged — callers check `canApplyCare` so
 * the refusal is visible in the UI rather than silent. A living dumpling never
 * refuses food; see `wastedHungerFor` for what overfeeding costs instead.
 */
export function applyCare(pet: Pet, input: ApplyCareInput): Pet {
  if (!canApplyCare(pet)) {
    return pet;
  }

  return withRevision(pet, {
    needs: applyCareToNeeds(
      pet.needs,
      input.action,
      input.tuning,
      input.context,
    ),
    lastCaredAtMs: Math.max(pet.lastCaredAtMs, input.atMs),
  });
}

/**
 * Feeding, with the mess it will produce already on the books.
 *
 * Every meal comes back out eventually, so scheduling the mess is not something
 * a caller may forget to do — the two are one operation. `messes.ts` decides how
 * long the dumpling holds on to it, and the schedule rides on the `Pet` so it
 * lands even if the app is closed the whole time.
 */
export function feedPet(
  pet: Pet,
  input: Readonly<{
    atMs: number;
    tuning: CareTuning;
    messConfig: MessConfig;
    random: RandomSource;
  }>,
): Pet {
  if (!canApplyCare(pet)) {
    return pet;
  }

  const fed = applyCare(pet, {
    action: 'feed',
    atMs: input.atMs,
    tuning: input.tuning,
  });

  return scheduleMess(fed, {
    atMs: input.atMs,
    random: input.random,
    config: input.messConfig,
  });
}

export function isCareAction(value: unknown): value is CareAction {
  return (
    typeof value === 'string' &&
    (CARE_ACTIONS as readonly string[]).includes(value)
  );
}
