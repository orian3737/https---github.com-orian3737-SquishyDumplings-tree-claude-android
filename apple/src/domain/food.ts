import { excludesAnimalProducts, excludesMeat, type Diet } from './diet';
import type { RandomSource } from './random';

/**
 * The food set.
 *
 * Food is free, unlimited, and never gated by coins. Coins buy appearance, never
 * survival: putting a currency spend in the feeding path would create a neglect
 * doom loop and break offline care, since coin spends are server-authoritative
 * while care is offline-first.
 *
 * There is no food picker. One swipe on the habitat's feed segment throws one
 * randomly chosen item into the environment. Variety comes from seeing different
 * foods over time rather than from selecting one, which keeps the most-repeated
 * interaction in the app to a single gesture with no selection UI.
 *
 * Items carry no hunger differences. A three-item pool is too small for hidden
 * per-item values to be discoverable, so the only ways food differs are which
 * items a diet sees and which one the dumpling walks to first.
 */
export const FOOD_ITEMS = [
  'pork-chop',
  'mixed-vegetable',
  'tofu',
  'scallion',
] as const;

export type FoodItem = (typeof FOOD_ITEMS)[number];

export type FoodDefinition = Readonly<{
  item: FoodItem;
  displayName: string;
  containsMeat: boolean;
  containsAnimalProduct: boolean;
  /**
   * The item served instead when a diet excludes this one. A substitution rather
   * than a removal, so every diet draws from a pool of the same size and choosing
   * vegetarian never means less variety.
   */
  substitute: FoodItem | null;
}>;

export const FOOD_TABLE: Readonly<Record<FoodItem, FoodDefinition>> = {
  'pork-chop': {
    item: 'pork-chop',
    displayName: 'Pork chop',
    containsMeat: true,
    containsAnimalProduct: true,
    substitute: 'mixed-vegetable',
  },
  'mixed-vegetable': {
    item: 'mixed-vegetable',
    displayName: 'Mixed vegetables',
    containsMeat: false,
    containsAnimalProduct: false,
    substitute: null,
  },
  tofu: {
    item: 'tofu',
    displayName: 'Tofu',
    containsMeat: false,
    containsAnimalProduct: false,
    substitute: null,
  },
  scallion: {
    item: 'scallion',
    displayName: 'Scallion',
    containsMeat: false,
    containsAnimalProduct: false,
    substitute: null,
  },
};

/**
 * The pool an omnivore draws from, and the basis every other diet substitutes
 * against. `mixed-vegetable` is absent here because it is the pork chop's
 * stand-in, not a fourth omnivore option.
 */
export const BASE_FOOD_POOL: readonly FoodItem[] = [
  'pork-chop',
  'tofu',
  'scallion',
];

export function isFoodItemAllowed(diet: Diet, item: FoodItem): boolean {
  const definition = FOOD_TABLE[item];

  if (definition.containsMeat && excludesMeat(diet)) {
    return false;
  }

  return !(definition.containsAnimalProduct && excludesAnimalProducts(diet));
}

/**
 * Maps one item onto what this diet actually receives. An excluded item becomes
 * its substitute; an item with no substitute is returned unchanged so a future
 * table entry cannot silently vanish from a pool.
 */
export function resolveFoodItemFor(diet: Diet, item: FoodItem): FoodItem {
  if (isFoodItemAllowed(diet, item)) {
    return item;
  }

  const substitute = FOOD_TABLE[item].substitute;
  if (substitute === null || !isFoodItemAllowed(diet, substitute)) {
    return item;
  }

  return substitute;
}

/** The pool a throw draws from for this diet. Always the same size as the base. */
export function foodItemsFor(diet: Diet): readonly FoodItem[] {
  return BASE_FOOD_POOL.map((item) => resolveFoodItemFor(diet, item));
}

/** Picks one item uniformly from the diet-appropriate pool. */
export function pickFoodItem(diet: Diet, random: RandomSource): FoodItem {
  const pool = foodItemsFor(diet);
  const index = Math.min(
    pool.length - 1,
    Math.max(0, Math.floor(random.next() * pool.length)),
  );

  return pool[index] as FoodItem;
}

/**
 * Orders landed food so the dumpling walks to its favorite first.
 *
 * The preference only affects the order several items already on the ground get
 * eaten. It never blocks, penalizes, or changes what a throw produces, so it reads
 * as character the player notices over time rather than a rule they must learn.
 * Ties keep their original landing order.
 */
export function sortFoodByPreference(
  items: readonly FoodItem[],
  favorite: FoodItem,
): readonly FoodItem[] {
  return [
    ...items.filter((item) => item === favorite),
    ...items.filter((item) => item !== favorite),
  ];
}

export function isFoodItem(value: unknown): value is FoodItem {
  return (
    typeof value === 'string' &&
    (FOOD_ITEMS as readonly string[]).includes(value)
  );
}
