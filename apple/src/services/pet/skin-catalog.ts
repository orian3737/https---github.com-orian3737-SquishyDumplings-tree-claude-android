import { rollRarity, type Rarity, type RandomSource } from '@/domain';

/**
 * Provisional local skin catalog.
 *
 * BUILD_SPEC section 5 makes the real catalog server-managed and BUILD_SPEC
 * section 6 makes the roll server-authoritative, because users can reinstall,
 * retry, revive, and eventually attach value to a result. PR 6 and PR 7 replace
 * everything here. It exists so the hatch reveal has something real to grant.
 *
 * Every rarity has at least one skin, which is what makes `rollFirstSkin` total.
 * There is a test asserting that, so adding a rarity cannot silently break the
 * hatch.
 */
export type SkinDefinition = Readonly<{
  id: string;
  displayName: string;
  rarity: Rarity;
}>;

export const SKIN_CATALOG: readonly SkinDefinition[] = [
  {
    id: 'skin-classic-steamer',
    displayName: 'Classic Steamer',
    rarity: 'common',
  },
  { id: 'skin-sesame', displayName: 'Sesame Sprinkle', rarity: 'uncommon' },
  { id: 'skin-chili-crisp', displayName: 'Chili Crisp', rarity: 'rare' },
  { id: 'skin-lotus-leaf', displayName: 'Lotus Leaf', rarity: 'epic' },
  { id: 'skin-gold-leaf', displayName: 'Gold Leaf', rarity: 'legendary' },
];

export const DEFAULT_SKIN_ID = 'skin-classic-steamer';

export function findSkin(skinId: string): SkinDefinition | null {
  return SKIN_CATALOG.find((skin) => skin.id === skinId) ?? null;
}

export function skinDisplayName(skinId: string): string {
  return findSkin(skinId)?.displayName ?? 'Mystery Wrapper';
}

export function skinsOfRarity(rarity: Rarity): readonly SkinDefinition[] {
  return SKIN_CATALOG.filter((skin) => skin.rarity === rarity);
}

export type FirstSkinRoll = Readonly<{
  rarity: Rarity;
  skin: SkinDefinition;
}>;

/**
 * Rolls the rarity and the skin granted by the first reveal.
 *
 * Provisional: the client is not the shipping authority for this result.
 */
export function rollFirstSkin(random: RandomSource): FirstSkinRoll {
  const rarity = rollRarity(random);
  const pool = skinsOfRarity(rarity);

  const index = Math.min(
    pool.length - 1,
    Math.max(0, Math.floor(random.next() * pool.length)),
  );

  const skin = pool[index] ?? findSkin(DEFAULT_SKIN_ID);
  if (skin === null || skin === undefined) {
    throw new Error(`no skin available for rarity ${rarity}`);
  }

  return { rarity, skin };
}
