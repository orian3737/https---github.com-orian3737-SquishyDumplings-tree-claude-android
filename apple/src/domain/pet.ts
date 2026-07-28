import type { Clock } from './clock';
import { DEFAULT_DIET, type Diet } from './diet';
import { BASE_FOOD_POOL, resolveFoodItemFor, type FoodItem } from './food';
import { createUuidV4 } from './ids';
import type { LifecycleStatus } from './lifecycle';
import { createInitialNeeds, type Needs } from './needs';
import { normalizePersonalityTags, type PersonalityTag } from './personality';
import type { RandomSource } from './random';
import { maxEvolutionStageFor, type Rarity } from './rarity';
import {
  DEFAULT_SLEEP_SCHEDULE,
  normalizeSleepSchedule,
  type SleepSchedule,
} from './sleep-schedule';

/**
 * The single dumpling.
 *
 * Roadmap invariant: one account has exactly one persistent dumpling. A skin is
 * only an appearance for that dumpling, so nothing in this module may ever
 * produce a second identity. Every operation below takes a `Pet` and returns a
 * `Pet` carrying the same `id`, `bornAtMs`, and wardrobe history.
 *
 * Field names mirror the `pets` table proposed in BUILD_SPEC section 5 so the
 * local cache and the eventual server row describe the same thing.
 */
export type Pet = Readonly<{
  id: string;
  name: string;
  rarity: Rarity;
  evolutionStage: number;
  needs: Needs;
  personalityTags: readonly PersonalityTag[];
  lifecycleStatus: LifecycleStatus;
  /** Filters the food pool a throw draws from. Never an economy restriction. */
  diet: Diet;
  /**
   * Which landed food this dumpling walks to first. Stored as a base-pool item and
   * resolved through the diet substitution on use, so switching to a vegetarian
   * diet cannot leave a favorite the dumpling is no longer served.
   */
  favoriteFood: FoodItem;
  /** The appearance currently worn. Always a member of `unlockedSkinIds`. */
  equippedSkinId: string;
  /** Every appearance the owner has unlocked for this one dumpling. */
  unlockedSkinIds: readonly string[];
  bornAtMs: number;
  diedAtMs: number | null;
  /** Basis for elapsed-time decay. */
  lastCaredAtMs: number;
  /**
   * When each eaten meal is due to come back out as a mess, sorted ascending.
   *
   * Persisted rather than held in a timer so a mess can land while the app is
   * closed — the player should come back to a habitat that carried on without
   * them. `messes.ts` owns the schedule; cleanliness stays the source of truth
   * for how many piles are actually visible.
   */
  pendingMessesAtMs: readonly number[];
  /**
   * The dumpling's quiet hours, in device local time.
   *
   * Lives on the pet rather than on the device for the same reason `diet` does: it
   * should follow the owner to a second device instead of being re-set on every
   * install. Inside this window the dumpling is in stasis — needs stop falling and
   * only energy recovers.
   */
  sleepSchedule: SleepSchedule;
  /**
   * Optimistic-concurrency counter. Incremented locally on every mutation so
   * queued writes have an order. BUILD_SPEC section 5 makes the server value
   * authoritative, so PR 7 overwrites this with the server's `result_revision`
   * on every successful sync — a local value is never trusted over a server one.
   */
  revision: number;
}>;

export const MAX_PET_NAME_LENGTH = 24;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * Trims, collapses runs of whitespace, drops control characters, and limits
 * length so a name is safe to display (FR-3). Over-long input is truncated
 * rather than rejected.
 */
export function normalizePetName(raw: string): string {
  return raw
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PET_NAME_LENGTH)
    .trim();
}

export function isValidPetName(raw: string): boolean {
  return normalizePetName(raw).length > 0;
}

export type HatchInput = Readonly<{
  /** The owner's current pet, or null when they have never hatched. */
  existingPet: Pet | null;
  name: string;
  rarity: Rarity;
  /** The skin granted by the first reveal. */
  skinId: string;
  /** Chosen during onboarding. Omitted means the omnivore default. */
  diet?: Diet;
  clock: Clock;
  random: RandomSource;
}>;

export type HatchResult =
  | Readonly<{ outcome: 'hatched'; pet: Pet }>
  /** The owner already has a dumpling. The existing one is returned unchanged. */
  | Readonly<{ outcome: 'already-hatched'; pet: Pet }>
  | Readonly<{ outcome: 'invalid-name'; reason: 'empty' }>;

/**
 * The only function that may create a `Pet`.
 *
 * It is idempotent by construction: given an existing pet it returns that pet
 * untouched, so repeated taps, retries, and relaunches cannot produce a second
 * dumpling (FR-3).
 */
export function hatchPet(input: HatchInput): HatchResult {
  if (input.existingPet !== null) {
    return { outcome: 'already-hatched', pet: input.existingPet };
  }

  const name = normalizePetName(input.name);
  if (name.length === 0) {
    return { outcome: 'invalid-name', reason: 'empty' };
  }

  const bornAtMs = input.clock.now();

  return {
    outcome: 'hatched',
    pet: {
      id: createUuidV4(input.random),
      name,
      rarity: input.rarity,
      evolutionStage: 0,
      needs: createInitialNeeds(),
      personalityTags: [],
      lifecycleStatus: 'alive',
      diet: input.diet ?? DEFAULT_DIET,
      // Rolled at hatch so each dumpling has a food it visibly prefers. Drawn
      // from the base pool because the diet substitution is applied on use.
      favoriteFood: BASE_FOOD_POOL[
        Math.min(
          BASE_FOOD_POOL.length - 1,
          Math.floor(input.random.next() * BASE_FOOD_POOL.length),
        )
      ] as FoodItem,
      equippedSkinId: input.skinId,
      unlockedSkinIds: [input.skinId],
      bornAtMs,
      diedAtMs: null,
      lastCaredAtMs: bornAtMs,
      pendingMessesAtMs: [],
      sleepSchedule: DEFAULT_SLEEP_SCHEDULE,
      revision: 1,
    },
  };
}

/**
 * Bumps the local revision. Every mutation in the domain goes through this, and
 * it re-pins `id` and `bornAtMs` so no caller can rewrite the identity.
 */
export function withRevision(pet: Pet, changes: Partial<Pet>): Pet {
  return {
    ...pet,
    ...changes,
    id: pet.id,
    bornAtMs: pet.bornAtMs,
    revision: pet.revision + 1,
  };
}

export function renamePet(pet: Pet, rawName: string): Pet {
  const name = normalizePetName(rawName);
  if (name.length === 0 || name === pet.name) {
    return pet;
  }

  return withRevision(pet, { name });
}

/**
 * Changes what the dumpling eats. Editable from settings at any time with no
 * penalty; it only affects which foods future throws draw from.
 */
export function setDiet(pet: Pet, diet: Diet): Pet {
  if (pet.diet === diet) {
    return pet;
  }

  return withRevision(pet, { diet });
}

/**
 * Moves the dumpling's quiet hours. Editable from settings at any time with no
 * penalty, like diet — it describes the owner's routine, not the pet's state.
 */
export function setSleepSchedule(pet: Pet, schedule: SleepSchedule): Pet {
  const next = normalizeSleepSchedule(schedule);

  if (
    next.startMinuteOfDay === pet.sleepSchedule.startMinuteOfDay &&
    next.endMinuteOfDay === pet.sleepSchedule.endMinuteOfDay
  ) {
    return pet;
  }

  return withRevision(pet, { sleepSchedule: next });
}

/**
 * The favorite this dumpling is actually served, after its diet is applied. A
 * vegetarian whose stored favorite is the pork chop prefers the mixed vegetables
 * that stand in for it.
 */
export function resolvedFavoriteFood(pet: Pet): FoodItem {
  return resolveFoodItemFor(pet.diet, pet.favoriteFood);
}

export function hasUnlockedSkin(pet: Pet, skinId: string): boolean {
  return pet.unlockedSkinIds.includes(skinId);
}

/** Adds an appearance to the wardrobe. Already-owned skins are a no-op. */
export function unlockSkin(pet: Pet, skinId: string): Pet {
  if (skinId.length === 0 || hasUnlockedSkin(pet, skinId)) {
    return pet;
  }

  return withRevision(pet, {
    unlockedSkinIds: [...pet.unlockedSkinIds, skinId],
  });
}

/**
 * A skin can only be worn once unlocked. Callers must consult this before
 * offering the action so a refusal is never invisible to the player.
 */
export function canEquipSkin(pet: Pet, skinId: string): boolean {
  return hasUnlockedSkin(pet, skinId) && pet.equippedSkinId !== skinId;
}

/**
 * Changes appearance only. The dumpling's identity, needs, and history are
 * untouched — equipping a skin never creates or replaces a pet.
 */
export function equipSkin(pet: Pet, skinId: string): Pet {
  if (!canEquipSkin(pet, skinId)) {
    return pet;
  }

  return withRevision(pet, { equippedSkinId: skinId });
}

export function petMaxEvolutionStage(pet: Pet): number {
  return maxEvolutionStageFor(pet.rarity);
}

export function withPersonalityTags(
  pet: Pet,
  tags: readonly PersonalityTag[],
): Pet {
  return withRevision(pet, { personalityTags: normalizePersonalityTags(tags) });
}
