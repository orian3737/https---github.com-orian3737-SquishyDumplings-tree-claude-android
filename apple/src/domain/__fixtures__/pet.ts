import { fixedClock } from '../clock';
import type { Needs } from '../needs';
import { hatchPet, type Pet } from '../pet';
import { createSeededRandom } from '../random';

/** Test-only builders. Nothing in the app imports this directory. */

export const FIXTURE_BORN_AT_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
export const FIXTURE_SKIN_ID = 'skin-classic-steamer';

export function createTestPet(overrides: Partial<Pet> = {}): Pet {
  const result = hatchPet({
    existingPet: null,
    name: 'Bao',
    rarity: 'common',
    skinId: FIXTURE_SKIN_ID,
    clock: fixedClock(FIXTURE_BORN_AT_MS),
    random: createSeededRandom(1),
  });

  if (result.outcome !== 'hatched') {
    throw new Error(`fixture failed to hatch: ${result.outcome}`);
  }

  return { ...result.pet, ...overrides };
}

export function needs(overrides: Partial<Needs> = {}): Needs {
  return {
    hunger: 80,
    cleanliness: 80,
    energy: 80,
    happiness: 80,
    ...overrides,
  };
}
