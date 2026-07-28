import { clampNeed, stinkinessOf, type NeedName } from './needs';

/**
 * Hard-coded fixture for the view-only habitat and wardrobe prototypes.
 *
 * This is not the game engine. The real rules live in the modules re-exported
 * from `./index`, and PR 3 replaces this fixture with a persisted `Pet` once the
 * hatch journey exists.
 */
export type { NeedName };

export type PrototypePet = {
  id: string;
  name: string;
  skinName: string;
  coins: number;
  needs: Record<NeedName, number>;
};

export const prototypePet: PrototypePet = {
  id: 'prototype-bao',
  name: 'Bao',
  skinName: 'Classic Steamer',
  coins: 24,
  needs: {
    hunger: 76,
    cleanliness: 42,
    energy: 68,
    happiness: 88,
  },
};

export { clampNeed };

/** Retained for the prototype screens; `stinkinessOf` is the canonical name. */
export const getStinkiness = stinkinessOf;
