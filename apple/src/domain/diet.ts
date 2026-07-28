/**
 * What the owner has decided their dumpling eats.
 *
 * This is a property of the dumpling, not a device preference. It is chosen
 * during hatch, editable in settings, and it syncs, because a device-local flag
 * would let a second phone throw meat at a vegetarian dumpling.
 *
 * Diet never restricts how much the dumpling can eat. Food is free and unlimited
 * for every diet. It only decides which items appear, and excluded items are
 * substituted rather than removed, so every diet draws from a pool of the same
 * size (see `food.ts`).
 *
 * `vegetarian` and `vegan` currently behave identically, because none of the MVP
 * foods are animal products beyond the pork chop. They are modeled separately so
 * that adding an egg, dairy, or honey item later is a table change rather than a
 * schema migration, and because the distinction matters to the people choosing it.
 */
export const DIETS = ['omnivore', 'vegetarian', 'vegan'] as const;

export type Diet = (typeof DIETS)[number];

/**
 * Hatch defaults to omnivore so the diet question can be one optional tap during
 * onboarding rather than a gate in front of meeting the dumpling.
 */
export const DEFAULT_DIET: Diet = 'omnivore';

export function excludesMeat(diet: Diet): boolean {
  return diet === 'vegetarian' || diet === 'vegan';
}

export function excludesAnimalProducts(diet: Diet): boolean {
  return diet === 'vegan';
}

export function isDiet(value: unknown): value is Diet {
  return (
    typeof value === 'string' && (DIETS as readonly string[]).includes(value)
  );
}
