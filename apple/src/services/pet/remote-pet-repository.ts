import {
  clampNeed,
  isDiet,
  isFoodItem,
  isLifecycleStatus,
  isRarity,
  normalizePendingMesses,
  normalizePetName,
  normalizeSleepSchedule,
  BASE_FOOD_POOL,
  DEFAULT_DIET,
  type FoodItem,
  type Pet,
  type PetRepository,
} from '@/domain';
import type { AppSupabaseClient } from '@/services/supabase/client';
import type { Database } from '@/services/supabase/database.types';

/**
 * The owner's dumpling, in Supabase.
 *
 * Deliberately the same `PetRepository` shape as the local one, so the sync layer
 * can hold both without knowing which is which. What differs is authority: this
 * side owns nothing about care. The server is authoritative only for things a
 * client must not be trusted with — the hatch roll today, coins and skin rolls
 * later — and everything else here is a backup of what the device decided.
 *
 * Row columns mirror `pets`. Anything the server row does not carry (equipped
 * skin history, for instance) is a gap to close in the migration rather than
 * something to invent here.
 */

type PetRow = Database['public']['Tables']['pets']['Row'];

export type RemotePetRepository = PetRepository & {
  /** The row as stored, for conflict resolution. Null when nothing is stored. */
  loadRemote(): Promise<Pet | null>;
};

function toMs(timestamp: string): number {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(ms: number): string {
  return new Date(Number.isFinite(ms) ? ms : 0).toISOString();
}

/**
 * A row into a `Pet`.
 *
 * The row is untrusted for the same reason the local cache is: it can have been
 * written by an older client, or by this one before a column existed. Where a
 * value is recoverable it is repaired; identity is never guessed.
 */
export function petFromRow(row: PetRow): Pet | null {
  const name = normalizePetName(row.name);
  if (name.length === 0 || !isRarity(row.rarity)) {
    return null;
  }

  if (!isLifecycleStatus(row.lifecycle_status)) {
    return null;
  }

  return {
    id: row.id,
    name,
    rarity: row.rarity,
    evolutionStage: Math.max(0, Math.floor(row.evolution_stage)),
    needs: {
      hunger: clampNeed(row.hunger),
      cleanliness: clampNeed(row.cleanliness),
      energy: clampNeed(row.energy),
      happiness: clampNeed(row.happiness),
    },
    // Unknown tags are dropped rather than fatal: a newer client may have written
    // a tag this build has never heard of, and that is not a reason to refuse the
    // player their dumpling.
    personalityTags: [],
    lifecycleStatus: row.lifecycle_status,
    diet: isDiet(row.diet) ? row.diet : DEFAULT_DIET,
    favoriteFood: isFoodItem(row.favorite_food)
      ? row.favorite_food
      : (BASE_FOOD_POOL[0] as FoodItem),
    equippedSkinId: row.skin_id,
    unlockedSkinIds: [row.skin_id],
    bornAtMs: toMs(row.born_at),
    diedAtMs: row.died_at === null ? null : toMs(row.died_at),
    lastCaredAtMs: toMs(row.last_cared_at),
    pendingMessesAtMs: normalizePendingMesses(
      (row.pending_messes_at ?? []).map(toMs),
    ),
    sleepSchedule: normalizeSleepSchedule({
      startMinuteOfDay: row.sleep_start_minute,
      endMinuteOfDay: row.sleep_end_minute,
    }),
    revision: Math.max(1, Math.floor(row.revision)),
  };
}

/**
 * The columns a client is allowed to write.
 *
 * Not a full row on purpose. `id`, `owner_id`, `born_at`, and `revision` are the
 * server's — the `bump_pet_revision` trigger re-pins them on every update — and
 * `rarity` is excluded because the hatch roll is server-authoritative and a client
 * must never be able to promote its own dumpling.
 */
function rowUpdateFrom(pet: Pet) {
  return {
    name: pet.name,
    evolution_stage: pet.evolutionStage,
    hunger: pet.needs.hunger,
    cleanliness: pet.needs.cleanliness,
    energy: pet.needs.energy,
    happiness: pet.needs.happiness,
    diet: pet.diet,
    favorite_food: pet.favoriteFood,
    skin_id: pet.equippedSkinId,
    lifecycle_status: pet.lifecycleStatus,
    last_cared_at: toIso(pet.lastCaredAtMs),
    died_at: pet.diedAtMs === null ? null : toIso(pet.diedAtMs),
    sleep_start_minute: pet.sleepSchedule.startMinuteOfDay,
    sleep_end_minute: pet.sleepSchedule.endMinuteOfDay,
    pending_messes_at: pet.pendingMessesAtMs.map(toIso),
  };
}

export function createRemotePetRepository(
  client: AppSupabaseClient,
): RemotePetRepository {
  async function loadRemote(): Promise<Pet | null> {
    // `maybeSingle` rather than `single`: no row is the normal state for someone
    // who has signed up and not hatched yet, and should not read as an error.
    const { data, error } = await client.from('pets').select('*').maybeSingle();

    if (error !== null) {
      throw new Error(`could not read the remote dumpling: ${error.message}`);
    }

    return data === null ? null : petFromRow(data);
  }

  return {
    loadRemote,
    loadPet: loadRemote,

    /**
     * Pushes local care up.
     *
     * An update rather than an upsert, and matched on `id`: only `hatch_pet` may
     * create a row, so a save that matches nothing means the dumpling has not been
     * hatched on the server yet. That is a real state during first sync, not an
     * error, and it resolves once hatch runs.
     */
    savePet: async (pet) => {
      const { error } = await client
        .from('pets')
        .update(rowUpdateFrom(pet))
        .eq('id', pet.id);

      if (error !== null) {
        throw new Error(`could not save the remote dumpling: ${error.message}`);
      }
    },

    /**
     * Deleting the pet row is account deletion, not sign-out.
     *
     * Sign-out clears the local cache and leaves the server alone — the whole
     * point of the backup is that signing out on one device does not destroy the
     * dumpling. So this refuses rather than doing something destructive under an
     * innocuous name.
     */
    clearPet: async () => {
      throw new Error(
        'clearPet is not supported remotely; sign-out clears the local cache and account deletion removes the row',
      );
    },
  };
}

export const __testing = { toMs, toIso, rowUpdateFrom };

/**
 * Hatches the caller's one dumpling on the server.
 *
 * The RPC is the authority, not this client: it rolls rarity with the documented
 * weights and is idempotent by construction, so a retry, a reinstall, or two
 * concurrent taps all resolve to the same single pet. That is precisely why the
 * provisional client-side roll is gone.
 *
 * `skinId` is still chosen here, which is a known gap rather than a decision. The
 * skin catalog does not exist server-side yet, so the server has nothing to
 * validate against; once it does, the roll moves behind the same boundary rarity
 * already sits behind. Until then a client could name a skin it did not earn —
 * harmless while every skin is free, and unacceptable once they are not.
 */
export async function hatchRemotePet(
  client: AppSupabaseClient,
  input: { name: string; skinId: string; diet: Pet['diet'] },
): Promise<Pet> {
  const { data, error } = await client.rpc('hatch_pet', {
    p_name: input.name,
    p_skin_id: input.skinId,
    p_diet: input.diet,
  });

  if (error !== null) {
    throw new Error(`hatch_pet failed: ${error.message}`);
  }

  if (data === null) {
    throw new Error('hatch_pet returned no dumpling');
  }

  const pet = petFromRow(data as PetRow);
  if (pet === null) {
    throw new Error('hatch_pet returned a row this build cannot read');
  }

  return pet;
}
