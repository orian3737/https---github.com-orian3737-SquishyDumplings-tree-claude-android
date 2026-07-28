import { DEFAULT_DIET, isDiet, type Diet } from './diet';
import { BASE_FOOD_POOL, isFoodItem, type FoodItem } from './food';
import { isLifecycleStatus, type LifecycleStatus } from './lifecycle';
import { normalizePendingMesses } from './messes';
import { clampNeed, type Needs } from './needs';
import { isPersonalityTag, normalizePersonalityTags } from './personality';
import { normalizePetName, type Pet } from './pet';
import { isRarity, maxEvolutionStageFor } from './rarity';
import {
  DEFAULT_SLEEP_SCHEDULE,
  normalizeSleepSchedule,
  type SleepSchedule,
} from './sleep-schedule';

/**
 * Serialization for the locally cached pet snapshot.
 *
 * The cache is untrusted input: it can be written by an older build, edited on a
 * jailbroken device, or truncated mid-write. `deserializePet` therefore validates
 * every field and returns a result instead of throwing, so a corrupt cache
 * surfaces as a handled state rather than a crash on launch.
 *
 * Repairs are applied where a value is recoverable (needs clamped into 0–100,
 * evolution stage capped at the rarity maximum, equipped skin forced into the
 * wardrobe) and rejected where identity would be guessed.
 */
export const PET_SNAPSHOT_VERSION = 1;

export type PetSnapshot = Readonly<{
  version: number;
  pet: Readonly<{
    id: string;
    name: string;
    rarity: string;
    evolutionStage: number;
    needs: Record<string, number>;
    personalityTags: readonly string[];
    lifecycleStatus: string;
    diet: string;
    favoriteFood: string;
    equippedSkinId: string;
    unlockedSkinIds: readonly string[];
    bornAtMs: number;
    diedAtMs: number | null;
    lastCaredAtMs: number;
    pendingMessesAtMs: readonly number[];
    sleepSchedule: { startMinuteOfDay: number; endMinuteOfDay: number };
    revision: number;
  }>;
}>;

export type DeserializeResult =
  | Readonly<{ ok: true; pet: Pet; repaired: boolean }>
  | Readonly<{ ok: false; error: string }>;

export function serializePet(pet: Pet): PetSnapshot {
  return {
    version: PET_SNAPSHOT_VERSION,
    pet: {
      id: pet.id,
      name: pet.name,
      rarity: pet.rarity,
      evolutionStage: pet.evolutionStage,
      needs: { ...pet.needs },
      personalityTags: [...pet.personalityTags],
      lifecycleStatus: pet.lifecycleStatus,
      diet: pet.diet,
      favoriteFood: pet.favoriteFood,
      equippedSkinId: pet.equippedSkinId,
      unlockedSkinIds: [...pet.unlockedSkinIds],
      bornAtMs: pet.bornAtMs,
      diedAtMs: pet.diedAtMs,
      lastCaredAtMs: pet.lastCaredAtMs,
      pendingMessesAtMs: [...pet.pendingMessesAtMs],
      sleepSchedule: { ...pet.sleepSchedule },
      revision: pet.revision,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readStringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const strings = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0,
  );

  return strings.length === value.length ? strings : null;
}

/**
 * Reads needs, clamping each value. A missing or non-numeric need is fatal
 * rather than defaulted, because silently substituting 80 would hand the player
 * a healthier pet than they left behind.
 */
function readNeeds(value: unknown): { needs: Needs; repaired: boolean } | null {
  if (!isRecord(value)) {
    return null;
  }

  const hunger = readFiniteNumber(value.hunger);
  const cleanliness = readFiniteNumber(value.cleanliness);
  const energy = readFiniteNumber(value.energy);
  const happiness = readFiniteNumber(value.happiness);

  if (
    hunger === null ||
    cleanliness === null ||
    energy === null ||
    happiness === null
  ) {
    return null;
  }

  const needs: Needs = {
    hunger: clampNeed(hunger),
    cleanliness: clampNeed(cleanliness),
    energy: clampNeed(energy),
    happiness: clampNeed(happiness),
  };

  const repaired =
    needs.hunger !== hunger ||
    needs.cleanliness !== cleanliness ||
    needs.energy !== energy ||
    needs.happiness !== happiness;

  return { needs, repaired };
}

function readSleepSchedule(value: unknown): SleepSchedule {
  if (!isRecord(value)) {
    return DEFAULT_SLEEP_SCHEDULE;
  }

  const start = readFiniteNumber(value.startMinuteOfDay);
  const end = readFiniteNumber(value.endMinuteOfDay);

  if (start === null || end === null) {
    return DEFAULT_SLEEP_SCHEDULE;
  }

  return normalizeSleepSchedule({
    startMinuteOfDay: start,
    endMinuteOfDay: end,
  });
}

export function deserializePet(input: unknown): DeserializeResult {
  if (!isRecord(input)) {
    return { ok: false, error: 'snapshot is not an object' };
  }

  const version = readFiniteNumber(input.version);
  if (version === null) {
    return { ok: false, error: 'snapshot version is missing' };
  }

  if (version !== PET_SNAPSHOT_VERSION) {
    return {
      ok: false,
      error: `unsupported snapshot version ${version}; expected ${PET_SNAPSHOT_VERSION}`,
    };
  }

  const raw = input.pet;
  if (!isRecord(raw)) {
    return { ok: false, error: 'snapshot pet is not an object' };
  }

  const id = readNonEmptyString(raw.id);
  if (id === null) {
    return { ok: false, error: 'pet id is missing' };
  }

  const storedName = typeof raw.name === 'string' ? raw.name : null;
  const name = storedName === null ? '' : normalizePetName(storedName);
  if (name.length === 0) {
    return { ok: false, error: 'pet name is missing' };
  }

  if (!isRarity(raw.rarity)) {
    return { ok: false, error: `unknown rarity ${String(raw.rarity)}` };
  }
  const rarity = raw.rarity;

  if (!isLifecycleStatus(raw.lifecycleStatus)) {
    return {
      ok: false,
      error: `unknown lifecycle status ${String(raw.lifecycleStatus)}`,
    };
  }
  const lifecycleStatus: LifecycleStatus = raw.lifecycleStatus;

  const readNeedsResult = readNeeds(raw.needs);
  if (readNeedsResult === null) {
    return { ok: false, error: 'pet needs are missing or invalid' };
  }

  // Diet and favorite food fall back to their defaults rather than failing. Unlike
  // needs, defaulting here neither advantages nor penalizes the player: the
  // omnivore default is the documented starting value, and a favorite is only an
  // eating-order preference.
  const diet: Diet = isDiet(raw.diet) ? raw.diet : DEFAULT_DIET;
  const favoriteFood: FoodItem = isFoodItem(raw.favoriteFood)
    ? raw.favoriteFood
    : (BASE_FOOD_POOL[0] as FoodItem);

  const bornAtMs = readFiniteNumber(raw.bornAtMs);
  if (bornAtMs === null) {
    return { ok: false, error: 'bornAtMs is missing' };
  }

  const lastCaredAtMs = readFiniteNumber(raw.lastCaredAtMs);
  if (lastCaredAtMs === null) {
    return { ok: false, error: 'lastCaredAtMs is missing' };
  }

  const equippedSkinId = readNonEmptyString(raw.equippedSkinId);
  if (equippedSkinId === null) {
    return { ok: false, error: 'equippedSkinId is missing' };
  }

  const rawUnlockedSkinIds = readStringArray(raw.unlockedSkinIds);
  if (rawUnlockedSkinIds === null) {
    return { ok: false, error: 'unlockedSkinIds is missing or invalid' };
  }

  const rawPersonalityTags = readStringArray(raw.personalityTags);
  if (rawPersonalityTags === null) {
    return { ok: false, error: 'personalityTags is missing or invalid' };
  }

  const rawEvolutionStage = readFiniteNumber(raw.evolutionStage);
  if (rawEvolutionStage === null) {
    return { ok: false, error: 'evolutionStage is missing' };
  }

  const rawRevision = readFiniteNumber(raw.revision);
  if (rawRevision === null) {
    return { ok: false, error: 'revision is missing' };
  }

  // Absent on snapshots written before meals scheduled their messes. An empty
  // schedule is what those saves actually meant — nothing was owed — so this
  // defaults rather than failing, and no version bump is needed.
  const pendingMessesAtMs = Array.isArray(raw.pendingMessesAtMs)
    ? normalizePendingMesses(
        raw.pendingMessesAtMs.filter(
          (entry): entry is number => typeof entry === 'number',
        ),
      )
    : [];

  // Absent on snapshots written before the dumpling had a bedtime. Defaulting is
  // right here for the same reason it is for diet: the documented default neither
  // advantages nor penalizes the player, so no version bump is needed.
  const sleepSchedule = readSleepSchedule(raw.sleepSchedule);

  // `diedAtMs` is legitimately null on a living pet, so absence is fine but a
  // present-and-unparseable value is fatal rather than quietly reset to null.
  let diedAtMs: number | null = null;
  if (raw.diedAtMs !== null && raw.diedAtMs !== undefined) {
    const parsedDiedAtMs = readFiniteNumber(raw.diedAtMs);
    if (parsedDiedAtMs === null) {
      return { ok: false, error: 'diedAtMs is invalid' };
    }
    diedAtMs = parsedDiedAtMs;
  }

  // Repairs: dedupe the wardrobe, keep the equipped skin inside it, cap the
  // stage at the rarity maximum, and keep counters non-negative.
  const unlockedSkinIds = Array.from(
    new Set([equippedSkinId, ...rawUnlockedSkinIds]),
  );
  const evolutionStage = Math.min(
    Math.max(0, Math.floor(rawEvolutionStage)),
    maxEvolutionStageFor(rarity),
  );
  const revision = Math.max(0, Math.floor(rawRevision));
  const personalityTags = normalizePersonalityTags(
    rawPersonalityTags.filter(isPersonalityTag),
  );

  const repaired =
    readNeedsResult.repaired ||
    name !== storedName ||
    diet !== raw.diet ||
    favoriteFood !== raw.favoriteFood ||
    unlockedSkinIds.length !== rawUnlockedSkinIds.length ||
    evolutionStage !== rawEvolutionStage ||
    revision !== rawRevision ||
    personalityTags.length !== rawPersonalityTags.length;

  return {
    ok: true,
    repaired,
    pet: {
      id,
      name,
      rarity,
      evolutionStage,
      needs: readNeedsResult.needs,
      personalityTags,
      lifecycleStatus,
      diet,
      favoriteFood,
      equippedSkinId,
      unlockedSkinIds,
      bornAtMs,
      diedAtMs,
      lastCaredAtMs,
      pendingMessesAtMs,
      sleepSchedule,
      revision,
    },
  };
}
