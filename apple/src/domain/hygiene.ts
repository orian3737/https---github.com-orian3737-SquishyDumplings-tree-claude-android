import { clampNeed, NEED_MAX, type Needs } from './needs';

/**
 * Cleanliness, expressed as poop piles.
 *
 * There is no cleanliness meter and no Stinky meter. The player reads how dirty
 * the dumpling is from how many piles are in the habitat, which makes this module
 * the only bridge between the internal 0–100 value and what the player can see.
 *
 * The curve is INJECTED. BUILD_SPEC section 14 still lists the pile density as an
 * open product decision, and the overfeed penalty rates are calibrated against the
 * same curve, so `PROVISIONAL_HYGIENE_CONFIG` exists to make the habitat runnable
 * and is not approved tuning.
 */
export type HygieneConfig = Readonly<{
  /** How much cleanliness each visible pile represents. */
  cleanlinessPerPile: number;
  /** The most piles allowed on screen at once, so the habitat stays readable. */
  maxPiles: number;
  /** Cleanliness restored by removing one pile. */
  cleanlinessPerTap: number;
}>;

/** PROVISIONAL — see the note above. */
export const PROVISIONAL_HYGIENE_CONFIG: HygieneConfig = {
  cleanlinessPerPile: 20,
  maxPiles: 5,
  cleanlinessPerTap: 20,
};

/**
 * How many piles the habitat should show.
 *
 * A spotless dumpling has none. Piles appear as cleanliness falls, capped so a
 * badly neglected habitat is unpleasant to look at without becoming unusable to
 * tap through.
 */
export function poopPileCount(
  cleanliness: number,
  config: HygieneConfig,
): number {
  const dirt = NEED_MAX - clampNeed(cleanliness);
  const perPile = Math.max(1, config.cleanlinessPerPile);

  return Math.min(Math.max(0, config.maxPiles), Math.floor(dirt / perPile));
}

/**
 * A short screen-reader summary of the habitat's state.
 *
 * Required, not optional: pile density is a purely visual signal, so without this
 * removing the meter would remove the information entirely for VoiceOver users
 * (BUILD_SPEC section 9).
 */
export function hygieneSummary(
  cleanliness: number,
  config: HygieneConfig,
): string {
  const piles = poopPileCount(cleanliness, config);

  if (piles === 0) {
    return 'The habitat is clean.';
  }

  const noun = piles === 1 ? 'mess' : 'messes';
  const mood =
    piles >= config.maxPiles
      ? ' Your dumpling is very uncomfortable.'
      : piles > 1
        ? ' Your dumpling is getting uncomfortable.'
        : '';

  return `${piles} ${noun} to clean up.${mood}`;
}

/** Cleanliness after removing one pile, clamped. */
export function cleanlinessAfterTap(
  cleanliness: number,
  config: HygieneConfig,
): number {
  return clampNeed(cleanliness + config.cleanlinessPerTap);
}

export function needsCleaning(needs: Needs, config: HygieneConfig): boolean {
  return poopPileCount(needs.cleanliness, config) > 0;
}
