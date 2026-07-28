import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSeededRandom,
  withRevision,
  type Needs,
  type Pet,
} from '@/domain';
import { createTestPet, needs } from '@/domain/__fixtures__/pet';
import {
  installAnimationFrames,
  uninstallAnimationFrames,
} from '@/test-support/animation-frames';
import {
  act,
  advanceBy,
  renderHook,
  type RenderedHook,
} from '@/test-support/render-hook';

import { LANDING_MAX_X, LANDING_MIN_X, LANDING_MIN_Y } from './throw-aim';
import { useHabitatLoop, type HabitatLoop } from './use-habitat-loop';

/**
 * Scheduling tests for the habitat loop.
 *
 * These exist because the bug they cover shipped. A meal that landed while the
 * dumpling was mid-behavior used to be dropped on the floor forever: work was
 * kicked off from several places, each firing once, and a task that could not start
 * at that instant was simply never retried. Nothing caught it but playing the app.
 *
 * So the assertions here are about *scheduling*, not about animation detail — what
 * the loop must eventually do regardless of what it happened to be doing when the
 * player acted.
 */

/** Mirrors the hook's own flight time: a throw is airborne for exactly this long. */
const FLIGHT_MS = 620;
/** The hook schedules its first pump this far after mount. */
const FIRST_PUMP_MS = 1400;
/**
 * The shortest an ambient behavior can run: the minimum walk plus the travel settle.
 * It is longer than a throw's flight, which is what lets a test reliably land a meal
 * while the loop is busy.
 */
const SHORTEST_AMBIENT_MS = 240 + 420;
/** Comfortably longer than any queue of tasks these tests can produce. */
const SETTLE_MS = 30_000;
/** Mirrors the hook's own cadence for the `zzz` off a sleeping dumpling. */
const SLEEP_PUFF_MS = 2200;
/** Sampling interval. Shorter than the shortest eat, so meals cannot hide between samples. */
const SAMPLE_MS = 100;
const SAMPLE_COUNT = 200;
/** Fixed so a failure reproduces. Any seed exercises the same scheduling rules. */
const RANDOM_SEED = 7;
const EPSILON = 1e-9;

type HarnessProps = Readonly<{
  initialPet: Pet;
  maxLandingY?: number;
  asleep?: boolean;
  onPetChange: (next: Pet) => void;
}>;

type Harness = Readonly<{
  loop: HabitatLoop;
  pet: Pet;
  /** Pushes a pet in from outside, the way elapsed-time decay does. */
  setPet: (next: Pet) => void;
}>;

/**
 * Owns pet state the way the habitat screen does, so a care mutation the loop makes
 * comes back to it on the next render instead of being swallowed by the test.
 */
function useHabitatHarness(props: HarnessProps): Harness {
  const [pet, setPet] = useState(props.initialPet);
  const report = props.onPetChange;

  const handlePetChange = useCallback(
    (next: Pet) => {
      report(next);
      setPet(next);
    },
    [report],
  );

  const loop = useHabitatLoop({
    pet,
    onPetChange: handlePetChange,
    maxLandingY: props.maxLandingY,
    asleep: props.asleep,
  });

  return { loop, pet, setPet };
}

let mounted: RenderedHook<HarnessProps, Harness>[] = [];

function mountHabitat(
  initial: Readonly<{
    initialPet: Pet;
    maxLandingY?: number;
    asleep?: boolean;
  }>,
): Readonly<{
  hook: RenderedHook<HarnessProps, Harness>;
  /** Every pet the loop handed back, in order. One entry per care mutation. */
  changes: Pet[];
  /** Re-reports a prop the screen owns, as a layout pass or the wall clock does. */
  update: (next: Partial<Omit<HarnessProps, 'onPetChange'>>) => void;
}> {
  const changes: Pet[] = [];
  const onPetChange = (next: Pet): void => {
    changes.push(next);
  };

  let props: HarnessProps = { ...initial, onPetChange };

  // Explicit type arguments: inferring them from the literal would make the optional
  // properties required ones that happen to accept undefined.
  const hook = renderHook<HarnessProps, Harness>(useHabitatHarness, props);

  mounted = [...mounted, hook];

  return {
    hook,
    changes,
    update: (next) => {
      props = { ...props, ...next };
      hook.rerender(props);
    },
  };
}

function petWith(overrides: Partial<Needs>): Pet {
  return createTestPet({ needs: needs(overrides) });
}

/** Hungry enough that several meals in a row each register, in a spotless habitat. */
const hungryPet = (): Pet => petWith({ hunger: 10, cleanliness: 100 });
const cleanPet = (): Pet => petWith({ cleanliness: 100 });
/** Dirty enough for exactly two seeded piles. */
const dirtyPet = (): Pet => petWith({ cleanliness: 60 });

/** Meals actually eaten: `feedPet` schedules exactly one mess per meal. */
function mealsEaten(pet: Pet): number {
  return pet.pendingMessesAtMs.length;
}

/**
 * The feedback one rub throws off.
 *
 * `petOnce` is the accessible path to the same care action as the gesture, so it
 * reaches the reaction without having to fake a finger travelling 110 points.
 */
function particleKindsAfterRub(pet: Pet): readonly string[] {
  const { hook } = mountHabitat({ initialPet: pet });

  act(() => {
    hook.current.loop.petOnce();
  });

  return hook.current.loop.particles.map((entry) => entry.kind);
}

beforeEach(() => {
  // Frames first: the shim is built on `setTimeout`, so faking timers afterwards is
  // what puts the walk animations on the fake clock.
  installAnimationFrames();
  vi.useFakeTimers();

  const seeded = createSeededRandom(RANDOM_SEED);
  vi.spyOn(Math, 'random').mockImplementation(() => seeded.next());
});

afterEach(() => {
  mounted.forEach((hook) => hook.unmount());
  mounted = [];
  vi.restoreAllMocks();
  vi.useRealTimers();
  uninstallAnimationFrames();
});

describe('useHabitatLoop scheduling', () => {
  it('eats a meal that landed while it was busy with an idle behavior', () => {
    // The regression. Pre-fix this meal stayed on the floor for the rest of the
    // session, because the only thing that ever asked for it to be eaten was its own
    // landing timer, and that fired while the loop was busy.
    const { hook } = mountHabitat({ initialPet: hungryPet() });

    // The first pump starts an ambient behavior, and even the shortest one outlasts a
    // throw's flight — so this meal is guaranteed to land mid-behavior.
    expect(SHORTEST_AMBIENT_MS).toBeGreaterThan(FLIGHT_MS);
    advanceBy(FIRST_PUMP_MS);

    act(() => {
      hook.current.loop.throwFood();
    });
    advanceBy(FLIGHT_MS);

    // On the floor and untouched: the running behavior still owns the loop.
    expect(hook.current.loop.food).toHaveLength(1);
    expect(hook.current.loop.food[0]?.phase).toBe('landed');
    expect(mealsEaten(hook.current.pet)).toBe(0);

    advanceBy(SETTLE_MS);

    expect(hook.current.loop.food).toEqual([]);
    expect(mealsEaten(hook.current.pet)).toBe(1);
    expect(hook.current.pet.needs.hunger).toBe(35);
  });

  it('serves two rapid throws as two separate meals', () => {
    const { hook } = mountHabitat({ initialPet: hungryPet() });
    advanceBy(FIRST_PUMP_MS);

    act(() => {
      hook.current.loop.throwFood();
      hook.current.loop.throwFood();
    });
    expect(hook.current.loop.food).toHaveLength(2);

    advanceBy(FLIGHT_MS);
    expect(
      hook.current.loop.food.every((entry) => entry.phase === 'landed'),
    ).toBe(true);

    // Sampled rather than only checked at the end: one walk swallowing both items
    // would show up as the count jumping straight from zero to two.
    const counts: number[] = [];
    for (let step = 0; step < SAMPLE_COUNT; step += 1) {
      advanceBy(SAMPLE_MS);
      counts.push(mealsEaten(hook.current.pet));
    }

    const jumps = counts.map((count, index) =>
      index === 0 ? count : count - (counts[index - 1] as number),
    );
    expect(Math.max(...jumps)).toBe(1);

    expect(hook.current.loop.food).toEqual([]);
    expect(mealsEaten(hook.current.pet)).toBe(2);
    expect(hook.current.pet.needs.hunger).toBe(60);
  });

  it('cancels the walk frame loop when it unmounts mid-walk', () => {
    const { hook, changes } = mountHabitat({ initialPet: hungryPet() });
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');

    act(() => {
      hook.current.loop.throwFood();
    });
    // Lands, and the pump walks to it. The shortest walk is 240ms, so 100ms in the
    // dumpling is always still on its way.
    advanceBy(FLIGHT_MS);
    advanceBy(100);
    expect(hook.current.loop.activity).toBe('walk');

    hook.unmount();
    expect(cancelFrame).toHaveBeenCalled();

    const changesAtUnmount = changes.length;
    advanceBy(SETTLE_MS);

    // The walk never finished, so the meal was never eaten.
    expect(changes).toHaveLength(changesAtUnmount);
    expect(changesAtUnmount).toBe(0);
  });

  it('clears pending timers when it unmounts during a post-meal settle', () => {
    const { hook, changes } = mountHabitat({ initialPet: hungryPet() });
    const clearPending = vi.spyOn(globalThis, 'clearTimeout');

    act(() => {
      hook.current.loop.throwFood();
      hook.current.loop.throwFood();
    });

    // Far enough for the first meal to be eaten, but inside the settle that follows
    // it — so the timer that would go on to serve the second meal is still pending.
    advanceBy(1000);
    expect(changes).toHaveLength(1);
    expect(hook.current.loop.food).toHaveLength(1);

    hook.unmount();
    expect(clearPending).toHaveBeenCalled();

    advanceBy(SETTLE_MS);

    // A leaked settle timer would have pumped, and the second meal would be gone.
    expect(changes).toHaveLength(1);
  });

  it('materialises an owed mess exactly once', () => {
    const { hook } = mountHabitat({ initialPet: cleanPet() });
    expect(hook.current.loop.piles).toEqual([]);

    advanceBy(FIRST_PUMP_MS + 5000);

    // Cleanliness slips the way elapsed-time decay makes it slip: one pile now owed.
    act(() => {
      hook.current.setPet(
        withRevision(hook.current.pet, {
          needs: { ...hook.current.pet.needs, cleanliness: 75 },
        }),
      );
    });

    advanceBy(SETTLE_MS);
    expect(hook.current.loop.piles).toHaveLength(1);
    expect(hook.current.loop.piles[0]?.id).toBe('pile-1');

    // The heartbeat pumps every 1.2s. Owed and present now agree, so none of those
    // passes may add a second pile.
    advanceBy(SETTLE_MS);
    expect(hook.current.loop.piles).toHaveLength(1);
  });

  it('restarts scrub progress when the finger moves to a different mess', () => {
    const { hook } = mountHabitat({ initialPet: dirtyPet() });
    expect(hook.current.loop.piles).toHaveLength(2);

    const first = hook.current.loop.piles[0];
    const second = hook.current.loop.piles[1];
    if (first === undefined || second === undefined) {
      throw new Error('expected two seeded piles');
    }

    // 120 of the 130 needed to clear one.
    act(() => {
      hook.current.loop.beginScrub(first.id);
      hook.current.loop.scrubMove(first.id, 120, 0);
    });
    expect(hook.current.loop.piles).toHaveLength(2);

    // Moving to the other mess starts it from scratch. Carrying the 120 across would
    // clear this one on the very first move, which is the flick-to-clean exploit.
    act(() => {
      hook.current.loop.beginScrub(second.id);
      hook.current.loop.scrubMove(second.id, 120, 0);
    });
    expect(hook.current.loop.piles).toHaveLength(2);

    act(() => {
      hook.current.loop.scrubMove(second.id, 140, 0);
    });
    expect(hook.current.loop.piles).toHaveLength(1);
    expect(hook.current.loop.piles[0]?.id).toBe(first.id);
  });

  it('never walks past the deepest usable point on the floor', () => {
    const maxLandingY = 0.3;
    const { hook } = mountHabitat({ initialPet: hungryPet(), maxLandingY });

    // A hard, shallow flick aims at the very back edge of the legal band.
    act(() => {
      hook.current.loop.throwFood({ dx: 500, dy: 10, vx: 0, vy: 0 });
    });
    advanceBy(FLIGHT_MS + 5000);
    expect(mealsEaten(hook.current.pet)).toBe(1);

    // The dumpling starts at 0.42, deeper than this screen allows, and only a walk
    // can bring it inside the band. Sampling starts once that first walk is done.
    const depths: number[] = [];
    const across: number[] = [];

    for (let step = 0; step < SAMPLE_COUNT; step += 1) {
      if (step % 40 === 0) {
        const deep = step % 80 === 0;
        act(() => {
          hook.current.loop.throwFood({
            dx: deep ? -500 : 500,
            dy: deep ? 400 : 10,
            vx: 0,
            vy: 0,
          });
        });
      }

      advanceBy(SAMPLE_MS);
      depths.push(hook.current.loop.petY);
      across.push(hook.current.loop.petX);
    }

    expect(Math.max(...depths)).toBeLessThanOrEqual(maxLandingY + EPSILON);
    expect(Math.min(...depths)).toBeGreaterThanOrEqual(LANDING_MIN_Y - EPSILON);
    expect(Math.max(...across)).toBeLessThanOrEqual(LANDING_MAX_X + EPSILON);
    expect(Math.min(...across)).toBeGreaterThanOrEqual(LANDING_MIN_X - EPSILON);
  });

  it('honours a floor limit that only arrives after the first layout pass', () => {
    // The screen cannot say how much floor the action wheel covers until it has
    // measured itself, so the loop runs on its conservative default until then.
    const { hook, update } = mountHabitat({ initialPet: hungryPet() });
    const tightened = 0.25;

    // A meal under the default sends the dumpling deeper than the wheel will allow.
    act(() => {
      hook.current.loop.throwFood({ dx: 0, dy: 10, vx: 0, vy: 0 });
    });
    advanceBy(FLIGHT_MS + 5000);
    expect(hook.current.loop.petY).toBeGreaterThan(tightened);

    update({ maxLandingY: tightened });

    // One meal inside the new band walks it back up; sampling starts after that, so
    // the walk out of the now-illegal spot is not counted against the limit.
    act(() => {
      hook.current.loop.throwFood();
    });
    advanceBy(FLIGHT_MS + 5000);

    const depths: number[] = [];
    for (let step = 0; step < SAMPLE_COUNT; step += 1) {
      if (step % 40 === 0) {
        act(() => {
          hook.current.loop.throwFood();
        });
      }

      advanceBy(SAMPLE_MS);
      depths.push(hook.current.loop.petY);
    }

    expect(Math.max(...depths)).toBeLessThanOrEqual(tightened + EPSILON);
  });
});

describe('useHabitatLoop rub feedback', () => {
  it('gives hearts for a rub that lands', () => {
    const kinds = particleKindsAfterRub(
      petWith({ happiness: 40, cleanliness: 100 }),
    );

    expect(kinds).toEqual(['heart', 'heart', 'heart']);
  });

  it('gives crosses, not the sleep mark, to a rub at full hearts', () => {
    // The bug this replaced: a dumpling with nothing left to gain threw `zzz`, which
    // reads as "tired" when it is simply content.
    const kinds = particleKindsAfterRub(
      petWith({ happiness: 100, cleanliness: 100 }),
    );

    expect(kinds).not.toContain('sleepy');
    expect(kinds).not.toContain('heart');
    expect(new Set(kinds)).toEqual(new Set(['cross']));
  });

  it('gives crosses, not the sleep mark, to a rub blocked by a mess', () => {
    const kinds = particleKindsAfterRub(petWith({ cleanliness: 60 }));

    expect(kinds).not.toContain('sleepy');
    expect(new Set(kinds)).toEqual(new Set(['cross']));
  });

  it('keeps the sleep mark for the one rub that is genuinely about tiredness', () => {
    // Not zero energy — the screen blocks the gesture entirely there. This is the
    // dumpling that is awake but too worn out for affection to land.
    const kinds = particleKindsAfterRub(
      petWith({ energy: 5, cleanliness: 100 }),
    );

    expect(kinds).toEqual(['sleepy']);
  });
});

describe('useHabitatLoop while asleep', () => {
  it('gives off zzz on a slow cadence, starting the moment it drops off', () => {
    const { hook, update } = mountHabitat({ initialPet: cleanPet() });
    expect(hook.current.loop.particles).toEqual([]);

    // Bedtime arrives while the app is open. The first puff is a timer rather than a
    // synchronous spawn, so it lands on the next tick instead of during the render.
    update({ asleep: true });
    advanceBy(0);
    expect(hook.current.loop.particles.map((entry) => entry.kind)).toEqual([
      'sleepy',
    ]);

    advanceBy(SLEEP_PUFF_MS * 3);
    const kinds = hook.current.loop.particles.map((entry) => entry.kind);
    expect(kinds).toHaveLength(4);
    expect(new Set(kinds)).toEqual(new Set(['sleepy']));
  });

  it('holds still while asleep, and picks the habitat back up on waking', () => {
    const { hook, changes, update } = mountHabitat({
      initialPet: hungryPet(),
      asleep: true,
    });

    act(() => {
      hook.current.loop.throwFood();
    });

    advanceBy(SETTLE_MS);

    // Nothing ran: no meal to serve, no ambient behavior, no care applied. A throw
    // at 3am that landed anyway would sit on the floor until morning.
    expect(hook.current.loop.food).toEqual([]);
    expect(hook.current.loop.activity).toBeNull();
    expect(hook.current.loop.petX).toBe(0.5);
    expect(hook.current.loop.petY).toBe(0.42);
    expect(changes).toEqual([]);

    update({ asleep: false });

    act(() => {
      hook.current.loop.throwFood();
    });
    advanceBy(SETTLE_MS);

    expect(hook.current.loop.food).toEqual([]);
    expect(mealsEaten(hook.current.pet)).toBe(1);
  });

  it('drops a walk that was already in flight when it falls asleep', () => {
    const { hook, changes, update } = mountHabitat({ initialPet: hungryPet() });

    act(() => {
      hook.current.loop.throwFood();
    });
    // Landed, and mid-walk toward the meal.
    advanceBy(FLIGHT_MS);
    advanceBy(100);
    expect(hook.current.loop.activity).toBe('walk');

    update({ asleep: true });
    advanceBy(0);
    expect(hook.current.loop.activity).toBeNull();

    advanceBy(SETTLE_MS);
    expect(changes).toEqual([]);
  });
});
