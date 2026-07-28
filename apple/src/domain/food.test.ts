import { describe, expect, it } from 'vitest';

import { DIETS, type Diet } from './diet';
import {
  BASE_FOOD_POOL,
  FOOD_TABLE,
  foodItemsFor,
  isFoodItem,
  isFoodItemAllowed,
  pickFoodItem,
  resolveFoodItemFor,
  sortFoodByPreference,
  type FoodItem,
} from './food';
import { createSeededRandom, sequenceRandom } from './random';

describe('diet-filtered pools', () => {
  it('serves an omnivore the base pool', () => {
    expect(foodItemsFor('omnivore')).toEqual(['pork-chop', 'tofu', 'scallion']);
  });

  it.each(['vegetarian', 'vegan'] as const)(
    'substitutes mixed vegetables for the pork chop on a %s diet',
    (diet) => {
      expect(foodItemsFor(diet)).toEqual([
        'mixed-vegetable',
        'tofu',
        'scallion',
      ]);
    },
  );

  it.each(DIETS)(
    'keeps the %s pool the same size, so no diet gets less variety',
    (diet) => {
      expect(foodItemsFor(diet)).toHaveLength(BASE_FOOD_POOL.length);
    },
  );

  it.each(DIETS)('never offers a %s diet a food it may not eat', (diet) => {
    for (const item of foodItemsFor(diet)) {
      expect(isFoodItemAllowed(diet, item)).toBe(true);
    }
  });

  it('never offers meat to a vegetarian', () => {
    expect(foodItemsFor('vegetarian')).not.toContain('pork-chop');
    expect(isFoodItemAllowed('vegetarian', 'pork-chop')).toBe(false);
  });

  it('leaves an already-allowed item untouched', () => {
    expect(resolveFoodItemFor('vegetarian', 'tofu')).toBe('tofu');
    expect(resolveFoodItemFor('omnivore', 'pork-chop')).toBe('pork-chop');
  });
});

describe('pickFoodItem', () => {
  it.each([
    [0, 'pork-chop'],
    [0.34, 'tofu'],
    [0.67, 'scallion'],
    [0.999999, 'scallion'],
  ] as const)('an omnivore roll of %s yields %s', (value, expected) => {
    expect(pickFoodItem('omnivore', sequenceRandom([value]))).toBe(expected);
  });

  it('a vegetarian roll at the bottom of the range yields the substitute', () => {
    expect(pickFoodItem('vegetarian', sequenceRandom([0]))).toBe(
      'mixed-vegetable',
    );
  });

  it.each(DIETS)('only ever picks something a %s diet can eat', (diet) => {
    const random = createSeededRandom(31);

    for (let index = 0; index < 500; index += 1) {
      expect(isFoodItemAllowed(diet, pickFoodItem(diet, random))).toBe(true);
    }
  });

  it('reaches every item in the pool over a seeded run', () => {
    const random = createSeededRandom(88);
    const seen = new Set<FoodItem>();

    for (let index = 0; index < 500; index += 1) {
      seen.add(pickFoodItem('omnivore', random));
    }

    expect(seen.size).toBe(BASE_FOOD_POOL.length);
  });
});

describe('sortFoodByPreference', () => {
  it('puts the favorite first so the dumpling walks to it first', () => {
    expect(
      sortFoodByPreference(['scallion', 'tofu', 'pork-chop'], 'tofu'),
    ).toEqual(['tofu', 'scallion', 'pork-chop']);
  });

  it('preserves landing order among the rest', () => {
    expect(
      sortFoodByPreference(['scallion', 'pork-chop', 'tofu'], 'tofu'),
    ).toEqual(['tofu', 'scallion', 'pork-chop']);
  });

  it('keeps every favorite when several of them landed', () => {
    expect(sortFoodByPreference(['scallion', 'tofu', 'tofu'], 'tofu')).toEqual([
      'tofu',
      'tofu',
      'scallion',
    ]);
  });

  it('leaves the order alone when the favorite is absent', () => {
    const landed: readonly FoodItem[] = ['scallion', 'pork-chop'];

    expect(sortFoodByPreference(landed, 'tofu')).toEqual(landed);
  });

  it('never drops or duplicates a landed item', () => {
    const landed: readonly FoodItem[] = [
      'scallion',
      'tofu',
      'pork-chop',
      'tofu',
    ];

    expect(sortFoodByPreference(landed, 'tofu')).toHaveLength(landed.length);
  });
});

describe('food table', () => {
  it('marks only the pork chop as meat', () => {
    const meat = Object.values(FOOD_TABLE)
      .filter((definition) => definition.containsMeat)
      .map((definition) => definition.item);

    expect(meat).toEqual(['pork-chop']);
  });

  it('gives every excluded item a substitute that all diets can eat', () => {
    for (const definition of Object.values(FOOD_TABLE)) {
      if (definition.substitute === null) continue;

      for (const diet of DIETS satisfies readonly Diet[]) {
        expect(isFoodItemAllowed(diet, definition.substitute)).toBe(true);
      }
    }
  });

  it.each([
    ['tofu', true],
    ['mixed-vegetable', true],
    ['steak', false],
  ])('isFoodItem(%s) -> %s', (value, expected) => {
    expect(isFoodItem(value)).toBe(expected);
  });
});
