import { describe, expect, it } from 'vitest';

import { createTestPet, needs } from './__fixtures__/pet';
import {
  applyCareToNeeds,
  attentionGainFor,
  attentionOutcomeFor,
  feedPet,
  PROVISIONAL_CARE_TUNING,
  willAnnoy,
} from './care';
import { PROVISIONAL_HYGIENE_CONFIG, poopPileCount } from './hygiene';
import { PROVISIONAL_MESS_CONFIG } from './messes';
import { createSeededRandom } from './random';

const tuning = PROVISIONAL_CARE_TUNING;
const START_MS = Date.UTC(2026, 0, 1, 12, 0, 0);

/**
 * Rubbing is gated on a clean habitat and on stamina. These are the rules that
 * close the care loop, so each block is asserted for both its effect and the
 * reaction it reports.
 */
describe('attentionOutcomeFor', () => {
  it('pays out normally in a clean habitat with stamina to spare', () => {
    const outcome = attentionOutcomeFor(needs({ happiness: 40 }), tuning);

    expect(outcome.blockedBy).toBe('none');
    expect(outcome.happinessGain).toBe(tuning.attentionHappinessGain);
    expect(outcome.energyCost).toBe(tuning.attentionEnergyCost);
  });

  it('blocks affection outright while any mess is on the floor', () => {
    const outcome = attentionOutcomeFor(needs({ happiness: 40 }), tuning, {
      messCount: 1,
    });

    expect(outcome.blockedBy).toBe('mess');
    expect(outcome.happinessGain).toBe(0);
  });

  it('charges no stamina for a rub a mess blocked', () => {
    // Otherwise a player who has not worked out the rule could rub their
    // dumpling to exhaustion in a dirty room and get nothing for it.
    const outcome = attentionOutcomeFor(needs(), tuning, { messCount: 3 });

    expect(outcome.energyCost).toBe(0);
  });

  it('blocks and charges nothing when stamina is short of one round', () => {
    const outcome = attentionOutcomeFor(
      needs({ energy: tuning.attentionEnergyCost - 1, happiness: 10 }),
      tuning,
    );

    expect(outcome.blockedBy).toBe('exhausted');
    expect(outcome.happinessGain).toBe(0);
    expect(outcome.energyCost).toBe(0);
  });

  it('allows the round that spends the last of the stamina', () => {
    const outcome = attentionOutcomeFor(
      needs({ energy: tuning.attentionEnergyCost, happiness: 10 }),
      tuning,
    );

    expect(outcome.blockedBy).toBe('none');
    expect(outcome.energyCost).toBe(tuning.attentionEnergyCost);
  });

  it('still charges stamina for pestering an already content dumpling', () => {
    const outcome = attentionOutcomeFor(needs({ happiness: 100 }), tuning);

    expect(outcome.blockedBy).toBe('sated');
    expect(outcome.happinessGain).toBe(0);
    expect(outcome.energyCost).toBe(tuning.attentionEnergyCost);
  });

  it('reports the mess before exhaustion when both apply', () => {
    // Cleaning is the actionable one: the player can fix it now, where waiting
    // out a nap they cannot.
    const outcome = attentionOutcomeFor(needs({ energy: 0 }), tuning, {
      messCount: 2,
    });

    expect(outcome.blockedBy).toBe('mess');
  });
});

describe('attention through applyCareToNeeds', () => {
  it('changes nothing at all when a mess blocks the rub', () => {
    const input = needs({ happiness: 40, energy: 90 });

    expect(
      applyCareToNeeds(input, 'attention', tuning, { messCount: 1 }),
    ).toEqual(input);
  });

  it('raises happiness and spends stamina once the habitat is clean', () => {
    const input = needs({ happiness: 40, energy: 90 });

    expect(
      applyCareToNeeds(input, 'attention', tuning, { messCount: 0 }),
    ).toEqual(
      needs({
        happiness: 40 + tuning.attentionHappinessGain,
        energy: 90 - tuning.attentionEnergyCost,
      }),
    );
  });

  it('cannot be spammed past the stamina floor', () => {
    let current = needs({ happiness: 0, energy: 100 });

    for (let round = 0; round < 100; round += 1) {
      current = applyCareToNeeds(current, 'attention', tuning);
    }

    expect(current.energy).toBeGreaterThanOrEqual(0);
    expect(current.energy).toBeLessThan(tuning.attentionEnergyCost);
  });
});

describe('attentionGainFor and willAnnoy', () => {
  it('agrees with the outcome it wraps', () => {
    const input = needs({ happiness: 40 });

    expect(attentionGainFor(input, tuning, { messCount: 2 })).toBe(0);
    expect(attentionGainFor(input, tuning)).toBe(tuning.attentionHappinessGain);
  });

  it('treats a dirty habitat as a reason the dumpling will not enjoy it', () => {
    const pet = createTestPet({ needs: needs({ happiness: 10 }) });

    expect(willAnnoy(pet, tuning)).toBe(false);
    expect(willAnnoy(pet, tuning, { messCount: 1 })).toBe(true);
  });
});

/**
 * The loop the owner asked for: feeding produces a mess, the mess blocks
 * affection, and cleaning is what unblocks it.
 */
describe('the feed to clean to pet loop', () => {
  it('closes: a meal eventually blocks petting until the habitat is cleaned', () => {
    const random = createSeededRandom(11);
    const hungry = createTestPet({
      needs: needs({ hunger: 40, cleanliness: 100, happiness: 40 }),
    });

    const fed = feedPet(hungry, {
      atMs: START_MS,
      tuning,
      messConfig: PROVISIONAL_MESS_CONFIG,
      random,
    });

    // The meal is on the books but has not landed, so petting still works.
    expect(fed.pendingMessesAtMs).toHaveLength(1);
    expect(
      attentionOutcomeFor(fed.needs, tuning, {
        messCount: poopPileCount(
          fed.needs.cleanliness,
          PROVISIONAL_HYGIENE_CONFIG,
        ),
      }).blockedBy,
    ).toBe('none');

    // Once it lands, cleanliness carries a pile and affection is blocked.
    const dirty = needs({
      ...fed.needs,
      cleanliness:
        fed.needs.cleanliness - PROVISIONAL_MESS_CONFIG.cleanlinessPerMess,
    });
    const messCount = poopPileCount(
      dirty.cleanliness,
      PROVISIONAL_HYGIENE_CONFIG,
    );

    expect(messCount).toBeGreaterThan(0);
    expect(attentionOutcomeFor(dirty, tuning, { messCount }).blockedBy).toBe(
      'mess',
    );

    // Scrubbing it away restores the affection path.
    expect(attentionOutcomeFor(dirty, tuning, { messCount: 0 }).blockedBy).toBe(
      'none',
    );
  });

  it('feeds stamina back so rubbing is sustainable rather than a one-way drain', () => {
    const random = createSeededRandom(5);
    const spent = createTestPet({ needs: needs({ hunger: 20, energy: 5 }) });

    const fed = feedPet(spent, {
      atMs: START_MS,
      tuning,
      messConfig: PROVISIONAL_MESS_CONFIG,
      random,
    });

    expect(fed.needs.energy).toBeGreaterThan(spent.needs.energy);
    expect(attentionOutcomeFor(fed.needs, tuning).blockedBy).not.toBe(
      'exhausted',
    );
  });
});
