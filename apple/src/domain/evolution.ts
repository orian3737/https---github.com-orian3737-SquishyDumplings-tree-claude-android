import { isAlive } from './lifecycle';
import { moodOf } from './needs';
import { petMaxEvolutionStage, withRevision, type Pet } from './pet';

/** BUILD_SPEC section 6: evolution needs mood >= 70 and a stage below the cap. */
export const EVOLUTION_MOOD_THRESHOLD = 70;

/**
 * Why evolution is unavailable. FR-8 requires the UI to explain the unmet
 * condition rather than just disabling the control, so the reason is part of the
 * domain rather than UI guesswork.
 */
export type EvolutionBlockedReason = 'not-alive' | 'max-stage' | 'mood-too-low';

export function evolutionBlockedReason(
  pet: Pet,
): EvolutionBlockedReason | null {
  if (!isAlive(pet.lifecycleStatus)) {
    return 'not-alive';
  }

  if (pet.evolutionStage >= petMaxEvolutionStage(pet)) {
    return 'max-stage';
  }

  if (moodOf(pet.needs) < EVOLUTION_MOOD_THRESHOLD) {
    return 'mood-too-low';
  }

  return null;
}

export function canEvolve(pet: Pet): boolean {
  return evolutionBlockedReason(pet) === null;
}

/**
 * Advances one stage per eligible call and never exceeds the rarity maximum
 * (FR-8). Calling it on an ineligible pet returns that same pet, which makes
 * repeated requests idempotent.
 */
export function evolvePet(pet: Pet): Pet {
  if (!canEvolve(pet)) {
    return pet;
  }

  return withRevision(pet, { evolutionStage: pet.evolutionStage + 1 });
}
