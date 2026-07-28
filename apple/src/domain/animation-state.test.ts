import { describe, expect, it } from 'vitest';

import { createTestPet, needs } from './__fixtures__/pet';
import {
  animationStateForBehavior,
  attentionAnimationStateFor,
  DROWSY_ENERGY_THRESHOLD,
  isPetAnimationState,
  restingAnimationStateFor,
  restingAnimationStateForNeeds,
} from './animation-state';
import { BEHAVIORS, HIGH_HAPPINESS_THRESHOLD } from './behavior';
import { isFullyExhausted, NEGLECT_THRESHOLD } from './needs';

describe('animationStateForBehavior', () => {
  it.each(BEHAVIORS)('maps %s to a known semantic state', (behavior) => {
    expect(isPetAnimationState(animationStateForBehavior(behavior))).toBe(true);
  });

  it.each([
    ['nap', 'sleepy'],
    ['yawn', 'sleepy'],
    ['hop-trick', 'hop'],
    ['sprint', 'hop'],
    ['tongue-out', 'tongue'],
    ['wave', 'wave'],
    ['squat', 'squat'],
    ['idle-sit', 'idle'],
    ['pace', 'idle'],
  ] as const)('maps %s to %s', (behavior, expected) => {
    expect(animationStateForBehavior(behavior)).toBe(expected);
  });
});

describe('restingAnimationStateForNeeds', () => {
  it.each([
    [needs({ energy: DROWSY_ENERGY_THRESHOLD - 1 }), 'sleepy'],
    [needs({ cleanliness: NEGLECT_THRESHOLD - 1 }), 'dirty'],
    [needs({ happiness: HIGH_HAPPINESS_THRESHOLD + 1 }), 'happy'],
    // The 'idle' cases pin happiness at the threshold, because a happier
    // dumpling would legitimately resolve to 'happy' instead.
    [needs({ happiness: HIGH_HAPPINESS_THRESHOLD }), 'idle'],
    [
      needs({
        energy: DROWSY_ENERGY_THRESHOLD,
        happiness: HIGH_HAPPINESS_THRESHOLD,
      }),
      'idle',
    ],
    [
      needs({
        cleanliness: NEGLECT_THRESHOLD,
        happiness: HIGH_HAPPINESS_THRESHOLD,
      }),
      'idle',
    ],
  ] as const)('case %# resolves to %s', (input, expected) => {
    expect(restingAnimationStateForNeeds(input)).toBe(expected);
  });

  it('prefers exhaustion over stink when both apply', () => {
    expect(
      restingAnimationStateForNeeds(needs({ energy: 5, cleanliness: 5 })),
    ).toBe('sleepy');
  });

  it('prefers stink over happiness when both apply', () => {
    expect(
      restingAnimationStateForNeeds(needs({ cleanliness: 5, happiness: 100 })),
    ).toBe('dirty');
  });

  it('keeps a merely tired dumpling awake', () => {
    // The reported bug: a few rounds of petting used to drop energy under the
    // behavior module's sluggishness threshold and shut the dumpling's eyes for
    // good. Sleeping now needs real exhaustion, and energy recovers, so this
    // state is reachable but temporary.
    for (let energy = DROWSY_ENERGY_THRESHOLD; energy <= 60; energy += 5) {
      expect(restingAnimationStateForNeeds(needs({ energy }))).not.toBe(
        'sleepy',
      );
    }
  });

  it('wakes up as soon as recovered energy crosses the threshold', () => {
    expect(
      restingAnimationStateForNeeds(
        needs({ energy: DROWSY_ENERGY_THRESHOLD - 1 }),
      ),
    ).toBe('sleepy');
    expect(
      restingAnimationStateForNeeds(needs({ energy: DROWSY_ENERGY_THRESHOLD })),
    ).not.toBe('sleepy');
  });
});

describe('attentionAnimationStateFor', () => {
  it.each([
    ['none', 'attention'],
    ['mess', 'dirty'],
    ['exhausted', 'sleepy'],
    ['sated', 'annoyed'],
  ] as const)('reacts to a %s rub with %s', (block, expected) => {
    expect(attentionAnimationStateFor(block)).toBe(expected);
  });

  it('gives every way a rub can fail its own distinguishable reaction', () => {
    const reactions = (['mess', 'exhausted', 'sated'] as const).map(
      attentionAnimationStateFor,
    );

    expect(new Set(reactions).size).toBe(reactions.length);
  });
});

describe('restingAnimationStateFor', () => {
  it.each(['dead', 'reviving'] as const)(
    'reports the death state while %s regardless of needs',
    (lifecycleStatus) => {
      const pet = createTestPet({
        lifecycleStatus,
        needs: needs({ happiness: 100 }),
      });

      expect(restingAnimationStateFor(pet)).toBe('dead');
    },
  );

  it('falls through to the needs-based state while alive', () => {
    const pet = createTestPet({ needs: needs({ energy: 10 }) });

    expect(restingAnimationStateFor(pet)).toBe('sleepy');
  });

  it('sleeps through quiet hours however rested it is', () => {
    const pet = createTestPet({ needs: needs({ energy: 100 }) });

    expect(restingAnimationStateFor(pet, true)).toBe('asleep');
  });
});

describe('drowsy is not asleep', () => {
  /**
   * The bug this pins: `sleepy` used to mean both "a bit tired" and "out cold", so a
   * wide-awake dumpling with energy at 14 wore a sleep mask and looked untouchable
   * while it was still perfectly pettable.
   */

  it.each([1, 5, 10, DROWSY_ENERGY_THRESHOLD - 1])(
    'energy %i is drowsy but awake, so it wears no mask',
    (energy) => {
      expect(restingAnimationStateForNeeds(needs({ energy }))).toBe('sleepy');
    },
  );

  it('only an empty tank is actually asleep', () => {
    expect(restingAnimationStateForNeeds(needs({ energy: 0 }))).toBe('asleep');
  });

  it('the mask boundary is exactly the habitat interaction gate', () => {
    // The two definitions drifting apart is the whole defect, so assert they agree
    // across the entire range rather than at a couple of sampled points. The habitat
    // blocks feeding and petting on `isFullyExhausted`; the mask must mean the same.
    for (let energy = 0; energy <= 100; energy += 1) {
      const current = needs({ energy });
      const looksAsleep = restingAnimationStateForNeeds(current) === 'asleep';

      expect(looksAsleep).toBe(isFullyExhausted(current));
    }
  });
});

describe('isPetAnimationState', () => {
  it.each([
    ['eat', true],
    ['revive', true],
    ['tongue', true],
    ['wave', true],
    ['squat', true],
    ['Dumpling', false],
    ['PetState', false],
  ])('%s -> %s', (value, expected) => {
    expect(isPetAnimationState(value)).toBe(expected);
  });
});
