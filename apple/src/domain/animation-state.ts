import { HIGH_HAPPINESS_THRESHOLD, type Behavior } from './behavior';
import type { AttentionBlock } from './care';
import { isAlive } from './lifecycle';
import { isFullyExhausted, NEGLECT_THRESHOLD, type Needs } from './needs';
import type { Pet } from './pet';

/**
 * The semantic animation vocabulary from ASSET_MANIFEST.
 *
 * Screens and game logic depend only on these names. Rive artboard,
 * state-machine, animation, and input names stay inside the Rive adapter, so a
 * `.riv` delivery can replace a prototype PNG state without touching domain or
 * screen code (AGENTS.md engineering rules).
 */
export const PET_ANIMATION_STATES = [
  'idle',
  'happy',
  /**
   * Drowsy, but awake and fully interactive. Low energy reads as a slower dumpling
   * that can still be fed and petted.
   */
  'sleepy',
  /**
   * Genuinely out: spent energy or the nightly quiet window. The player cannot
   * interact through this, and it is the only state that wears the sleep mask.
   *
   * Distinct from `sleepy` on purpose. The two shared one name once, which put a sleep
   * mask on a wide-awake dumpling any time its energy dipped below the drowsy line.
   */
  'asleep',
  'hop',
  'tongue',
  'wave',
  'squat',
  'eat',
  'walk',
  'attention',
  /** Brief tummy ache after being overfed. */
  'sick',
  /** Over-stimulated by petting. The only signal that affection gain hit zero. */
  'annoyed',
  'dirty',
  'cleaned',
  'evolve',
  'dead',
  'hatch',
  'revive',
] as const;

export type PetAnimationState = (typeof PET_ANIMATION_STATES)[number];

/**
 * The resting state a behavior settles into. Several behaviors share a state:
 * the prototype renderer only has four PNGs, and the Rive rig is expected to
 * distinguish them later without changing this mapping's callers.
 */
const BEHAVIOR_ANIMATION_STATES: Readonly<Record<Behavior, PetAnimationState>> =
  {
    'idle-sit': 'idle',
    stretch: 'idle',
    'look-around': 'idle',
    yawn: 'sleepy',
    nap: 'sleepy',
    'waddle-left': 'idle',
    'waddle-right': 'idle',
    pace: 'idle',
    sprint: 'hop',
    'peek-over-edge': 'idle',
    'hop-trick': 'hop',
    wobble: 'hop',
    'tongue-out': 'tongue',
    wave: 'wave',
    squat: 'squat',
  };

export function animationStateForBehavior(
  behavior: Behavior,
): PetAnimationState {
  return BEHAVIOR_ANIMATION_STATES[behavior];
}

/**
 * Energy below which the dumpling looks drowsy.
 *
 * Deliberately much lower than `LOW_ENERGY_THRESHOLD`, which only biases ambient
 * behavior toward sluggish picks. Energy regenerates over time, so this clears itself.
 *
 * This is a *look*, not a sleep. The dumpling stays awake and interactive down to the
 * stamina floor; only `isFullyExhausted` — energy at zero — actually puts it under, and
 * that is the boundary the habitat gates interaction on. Conflating the two is what
 * previously masked an awake dumpling, so the two thresholds are named for what they
 * each control and must stay separate.
 */
export const DROWSY_ENERGY_THRESHOLD = 15;

/**
 * The state that reflects how the dumpling currently feels, independent of any
 * ambient behavior or one-shot reaction.
 *
 * Thresholds are reused from the needs and behavior modules rather than invented
 * here, so there is one definition of "neglected".
 */
export function restingAnimationStateFor(
  pet: Pick<Pet, 'lifecycleStatus' | 'needs'>,
  /**
   * True inside the dumpling's quiet hours. Night beats every other resting
   * state: a dumpling in stasis is asleep whatever its needs happen to say.
   */
  isAsleep = false,
): PetAnimationState {
  if (!isAlive(pet.lifecycleStatus)) {
    return 'dead';
  }

  if (isAsleep) {
    return 'asleep';
  }

  return restingAnimationStateForNeeds(pet.needs);
}

export function restingAnimationStateForNeeds(needs: Needs): PetAnimationState {
  // Checked before the drowsy band so this function agrees with the habitat's own
  // sleep gate no matter who calls it, rather than only when the caller remembers to
  // pass `isAsleep`.
  if (isFullyExhausted(needs)) {
    return 'asleep';
  }

  if (needs.energy < DROWSY_ENERGY_THRESHOLD) {
    return 'sleepy';
  }

  if (needs.cleanliness < NEGLECT_THRESHOLD) {
    return 'dirty';
  }

  if (needs.happiness > HIGH_HAPPINESS_THRESHOLD) {
    return 'happy';
  }

  return 'idle';
}

/**
 * How the dumpling reacts to being rubbed.
 *
 * Each way a rub can fail gets its own reaction, because the reaction is the
 * only feedback the player receives — there is no affection meter to watch, so
 * an ambiguous response would leave "why did nothing happen?" unanswerable.
 */
export function attentionAnimationStateFor(
  block: AttentionBlock,
): PetAnimationState {
  switch (block) {
    case 'none':
      return 'attention';
    case 'mess':
      return 'dirty';
    case 'exhausted':
      return 'sleepy';
    case 'sated':
      return 'annoyed';
  }
}

export function isPetAnimationState(
  value: unknown,
): value is PetAnimationState {
  return (
    typeof value === 'string' &&
    (PET_ANIMATION_STATES as readonly string[]).includes(value)
  );
}
