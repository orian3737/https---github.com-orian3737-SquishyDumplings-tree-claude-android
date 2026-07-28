import { describe, expect, it } from 'vitest';

import { needs } from './__fixtures__/pet';
import {
  BEHAVIORS,
  behaviorCandidates,
  behaviorDurationMs,
  biasedWeightFor,
  FORBIDDEN_FOLLOWING_BEHAVIORS,
  HIGH_HAPPINESS_THRESHOLD,
  isBehavior,
  LOW_ENERGY_THRESHOLD,
  LOW_HUNGER_THRESHOLD,
  pickNextBehavior,
  type Behavior,
} from './behavior';
import { createSeededRandom, sequenceRandom } from './random';

describe('behaviorCandidates', () => {
  it('offers the full pool on the first pick', () => {
    expect(behaviorCandidates(null)).toEqual(BEHAVIORS);
  });

  it.each(BEHAVIORS)('never repeats %s immediately', (behavior) => {
    expect(behaviorCandidates(behavior)).not.toContain(behavior);
  });

  it('forbids waking straight out of a nap into motion', () => {
    const candidates = behaviorCandidates('nap');

    expect(candidates).not.toContain('sprint');
    expect(candidates).not.toContain('hop-trick');
    expect(candidates).not.toContain('waddle-left');
    expect(candidates).not.toContain('waddle-right');
    expect(candidates).toContain('idle-sit');
  });

  it('forbids sprinting or hopping straight out of a yawn', () => {
    const candidates = behaviorCandidates('yawn');

    expect(candidates).not.toContain('sprint');
    expect(candidates).not.toContain('hop-trick');
    expect(candidates).toContain('wobble');
  });

  it('leaves unrestricted behaviors with everything but themselves', () => {
    expect(behaviorCandidates('stretch')).toHaveLength(BEHAVIORS.length - 1);
  });
});

describe('biasedWeightFor', () => {
  const baseline = needs();

  it('boosts sluggish behavior when energy is low', () => {
    const low = needs({ energy: LOW_ENERGY_THRESHOLD - 1 });

    expect(biasedWeightFor('nap', low)).toBeGreaterThan(
      biasedWeightFor('nap', baseline),
    );
  });

  it('dampens playful behavior when energy is low', () => {
    const low = needs({ energy: LOW_ENERGY_THRESHOLD - 1, happiness: 50 });

    expect(biasedWeightFor('sprint', low)).toBeLessThan(
      biasedWeightFor('sprint', needs({ happiness: 50 })),
    );
  });

  it('applies no energy bias exactly at the threshold', () => {
    expect(
      biasedWeightFor('nap', needs({ energy: LOW_ENERGY_THRESHOLD })),
    ).toBe(biasedWeightFor('nap', baseline));
  });

  it('boosts playful behavior when happiness is high', () => {
    const happy = needs({ happiness: HIGH_HAPPINESS_THRESHOLD + 1 });

    expect(biasedWeightFor('hop-trick', happy)).toBeGreaterThan(
      biasedWeightFor(
        'hop-trick',
        needs({ happiness: HIGH_HAPPINESS_THRESHOLD }),
      ),
    );
  });

  it('favors sitting still and dampens everything else when hungry', () => {
    const hungry = needs({ hunger: LOW_HUNGER_THRESHOLD - 1, happiness: 50 });

    expect(biasedWeightFor('idle-sit', hungry)).toBeGreaterThan(
      biasedWeightFor('idle-sit', needs({ happiness: 50 })),
    );
    expect(biasedWeightFor('pace', hungry)).toBeLessThan(
      biasedWeightFor('pace', needs({ happiness: 50 })),
    );
  });

  it('keeps every weight positive so no behavior becomes unreachable', () => {
    const worst = needs({ hunger: 0, cleanliness: 0, energy: 0, happiness: 0 });

    for (const behavior of BEHAVIORS) {
      expect(biasedWeightFor(behavior, worst)).toBeGreaterThan(0);
    }
  });
});

describe('pickNextBehavior', () => {
  it('returns the first candidate when the roll lands at zero', () => {
    const picked = pickNextBehavior({
      lastBehavior: null,
      needs: needs(),
      random: sequenceRandom([0]),
    });

    expect(picked).toBe(BEHAVIORS[0]);
  });

  it('returns the last candidate when the roll lands at the top of the range', () => {
    const picked = pickNextBehavior({
      lastBehavior: null,
      needs: needs(),
      random: sequenceRandom([0.9999999999]),
    });

    expect(picked).toBe(BEHAVIORS[BEHAVIORS.length - 1]);
  });

  it('honors both the repeat and transition rules across a long seeded run', () => {
    const random = createSeededRandom(4242);
    const seen = new Set<Behavior>();
    let last: Behavior | null = null;

    for (let step = 0; step < 2_000; step += 1) {
      const next = pickNextBehavior({
        lastBehavior: last,
        needs: needs(),
        random,
      });

      expect(next).not.toBe(last);
      if (last !== null) {
        const forbidden = FORBIDDEN_FOLLOWING_BEHAVIORS[last] ?? [];
        expect(forbidden).not.toContain(next);
      }

      seen.add(next);
      last = next;
    }

    // Every behavior stays reachable, so the pool does not silently shrink.
    expect(seen.size).toBe(BEHAVIORS.length);
  });

  it('picks a legal behavior for any starting behavior', () => {
    const random = createSeededRandom(7);

    for (const behavior of BEHAVIORS) {
      const next = pickNextBehavior({
        lastBehavior: behavior,
        needs: needs(),
        random,
      });

      expect(behaviorCandidates(behavior)).toContain(next);
    }
  });
});

describe('behavior metadata', () => {
  it.each(BEHAVIORS)('%s has a positive duration', (behavior) => {
    expect(behaviorDurationMs(behavior)).toBeGreaterThan(0);
  });

  it.each([
    ['nap', true],
    ['NAP', false],
    ['dance', false],
  ])('isBehavior(%s) -> %s', (value, expected) => {
    expect(isBehavior(value)).toBe(expected);
  });
});
