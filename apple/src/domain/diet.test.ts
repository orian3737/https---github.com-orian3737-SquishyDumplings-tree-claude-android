import { describe, expect, it } from 'vitest';

import { createTestPet } from './__fixtures__/pet';
import { DEFAULT_DIET, DIETS, isDiet } from './diet';
import { foodItemsFor, isFoodItemAllowed } from './food';
import { resolvedFavoriteFood, setDiet } from './pet';

describe('diet defaults', () => {
  it('hatches an omnivore unless onboarding says otherwise', () => {
    expect(createTestPet().diet).toBe(DEFAULT_DIET);
    expect(DEFAULT_DIET).toBe('omnivore');
  });
});

describe('setDiet', () => {
  it.each(DIETS)('switches to %s and bumps the revision', (diet) => {
    const pet = createTestPet({ diet: 'omnivore' });

    if (diet === 'omnivore') {
      expect(setDiet(pet, diet)).toBe(pet);
      return;
    }

    const updated = setDiet(pet, diet);
    expect(updated.diet).toBe(diet);
    expect(updated.revision).toBe(pet.revision + 1);
    expect(updated.id).toBe(pet.id);
  });

  it('is a no-op when the diet is unchanged', () => {
    const pet = createTestPet({ diet: 'vegan' });

    expect(setDiet(pet, 'vegan')).toBe(pet);
  });

  it('carries no penalty: needs and wardrobe are untouched', () => {
    const pet = createTestPet();
    const updated = setDiet(pet, 'vegetarian');

    expect(updated.needs).toEqual(pet.needs);
    expect(updated.unlockedSkinIds).toEqual(pet.unlockedSkinIds);
    expect(updated.equippedSkinId).toBe(pet.equippedSkinId);
  });
});

describe('resolvedFavoriteFood', () => {
  it('keeps a favorite the dumpling can still be served', () => {
    const pet = createTestPet({ diet: 'omnivore', favoriteFood: 'tofu' });

    expect(resolvedFavoriteFood(pet)).toBe('tofu');
  });

  it('substitutes when a diet change made the favorite unavailable', () => {
    const omnivore = createTestPet({
      diet: 'omnivore',
      favoriteFood: 'pork-chop',
    });

    expect(resolvedFavoriteFood(omnivore)).toBe('pork-chop');
    expect(resolvedFavoriteFood(setDiet(omnivore, 'vegetarian'))).toBe(
      'mixed-vegetable',
    );
  });

  it.each(DIETS)(
    'always resolves to something a %s diet is actually served',
    (diet) => {
      for (const favoriteFood of ['pork-chop', 'tofu', 'scallion'] as const) {
        const pet = createTestPet({ diet, favoriteFood });
        const resolved = resolvedFavoriteFood(pet);

        expect(isFoodItemAllowed(diet, resolved)).toBe(true);
        expect(foodItemsFor(diet)).toContain(resolved);
      }
    },
  );
});

describe('isDiet', () => {
  it.each([
    ['omnivore', true],
    ['vegetarian', true],
    ['vegan', true],
    ['pescatarian', false],
    ['', false],
  ])('%s -> %s', (value, expected) => {
    expect(isDiet(value)).toBe(expected);
  });
});
