import { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyCare,
  animationStateForBehavior,
  attentionAnimationStateFor,
  attentionOutcomeFor,
  behaviorDurationMs,
  cleanlinessAfterTap,
  feedPet,
  isFullyExhausted,
  pickFoodItem,
  pickNextBehavior,
  poopPileCount,
  PROVISIONAL_HYGIENE_CONFIG,
  PROVISIONAL_CARE_TUNING,
  PROVISIONAL_MESS_CONFIG,
  resolvedFavoriteFood,
  sortFoodByPreference,
  systemRandom,
  wastedHungerFor,
  withRevision,
  type AttentionBlock,
  type FoodItem,
  type Behavior,
  type Pet,
  type PetAnimationState,
} from '@/domain';

import {
  boundsFor,
  DEFAULT_LANDING_MAX_Y,
  landingFor,
  randomFloorSpot,
  type ThrowAim,
} from './throw-aim';

/**
 * The feeding loop.
 *
 * Flicking the wheel throws one random diet-appropriate item into the room. It
 * lands where it was aimed, the dumpling walks over, and hunger updates when it
 * actually eats — not when the item is thrown. That ordering is the point of the
 * design: the pet looks autonomous rather than like a target.
 *
 * Which item it walks to first comes from the domain's `sortFoodByPreference`, so
 * the favourite is honoured without this layer knowing what a favourite means.
 *
 * The loop is event-driven — a landing timer, then frame callbacks — rather than an
 * effect watching the food list. Watching would set state synchronously inside an
 * effect on every change, which cascades renders.
 *
 * Messes are NOT owned here. A meal schedules its mess on the `Pet` through
 * `feedPet`, the elapsed-time catch-up lands it whenever it comes due — including
 * while the app was closed — and this hook only materialises whatever cleanliness
 * says is currently owed.
 */

export type Particle = Readonly<{
  id: string;
  x: number;
  y: number;
  scale: number;
  drift: number;
  /**
   * Hearts while petting, bubbles while scrubbing, a cross when a rub did not land,
   * and a sleepy mark only while the dumpling is actually asleep.
   */
  kind: 'heart' | 'sleepy' | 'bubble' | 'cross';
}>;

export type PoopPile = Readonly<{
  id: string;
  /** Fraction of habitat width. */
  x: number;
  /** Fraction of the floor band. */
  y: number;
  scale: number;
}>;

export type ThrownFood = Readonly<{
  /** Stable key. Also the care-event idempotency key once sync arrives. */
  id: string;
  item: FoodItem;
  /** Landing position as a fraction of the floor band's width. */
  x: number;
  /** Landing position as a fraction of the floor band's height. */
  y: number;
  phase: 'flying' | 'landed';
}>;

const FLIGHT_MS = 620;
const EAT_MS = 620;
const WALK_MS_PER_FRACTION = 1150;
const MIN_WALK_MS = 240;
const hygiene = PROVISIONAL_HYGIENE_CONFIG;

/** How long the dumpling takes to settle after leaving a mess. */
const RELIEVE_SETTLE_MS = 520;

/**
 * Rubbing distance, in points, that counts as one round of attention.
 *
 * FR-5 asks for a deliberate gesture threshold: a stray touch while aiming the wheel
 * should not pet the dumpling, and holding still should not either.
 */
const RUB_DISTANCE_PER_ROUND = 110;
/** Scrubbing distance over one mess before it is gone. */
const SCRUB_DISTANCE_PER_PILE = 130;
const ATTENTION_SETTLE_MS = 460;
/**
 * How often the pump is nudged when nothing else has nudged it. Slow, because it
 * is a safety net rather than the mechanism.
 */
const PUMP_HEARTBEAT_MS = 1200;
/**
 * How long a single task may hold the busy flag before the watchdog assumes it
 * died. Well beyond the longest real task, so it cannot mask a merely slow one.
 */
const STUCK_TASK_MS = 15_000;
/** A short uninterrupted nap restores one normal rest action from zero energy. */
const FULL_SLEEP_RECOVERY_MS = 9000;
/** How often a sleeping dumpling gives off a `zzz`. Slow, like breathing. */
const SLEEP_PUFF_MS = 2200;

/**
 * What a round of attention throws off.
 *
 * Only a rub that actually landed gets hearts. A blocked one gets a cross, because
 * there is no affection meter to check — hearts that quietly did nothing would look
 * exactly like hearts that worked, and the pose alone (`annoyed`, `dirty`) is a thin
 * signal to hang the whole interaction on.
 *
 * `sleepy` is reserved for sleep. It used to fire for every blocked rub, which meant
 * petting a perfectly content dumpling produced `zzz` and read as "tired" when the
 * dumpling was simply full up on affection.
 */
const ATTENTION_PARTICLES: Readonly<
  Record<AttentionBlock, Readonly<{ kind: Particle['kind']; count: number }>>
> = {
  none: { kind: 'heart', count: 3 },
  mess: { kind: 'cross', count: 1 },
  // Genuinely too tired to enjoy it, which is the one blocked rub `zzz` still fits.
  exhausted: { kind: 'sleepy', count: 1 },
  sated: { kind: 'cross', count: 2 },
};

export type HabitatLoop = Readonly<{
  food: readonly ThrownFood[];
  /** Dumpling position as a fraction of habitat width. 0.5 is centre. */
  petX: number;
  /** Dumpling depth as a fraction of the floor band. 0 is the back wall. */
  petY: number;
  piles: readonly PoopPile[];
  removePile: (id: string) => void;
  particles: readonly Particle[];
  /** Report the rub gesture on the pet; rounds of care fall out of its path length. */
  beginRub: () => void;
  rubMove: (dx: number, dy: number) => void;
  /** The same gesture over a mess, which scrubs it away instead. */
  beginScrub: (pileId: string) => void;
  scrubMove: (pileId: string, dx: number, dy: number) => void;
  /** The non-gesture path to the same care action, for VoiceOver and Switch Control. */
  petOnce: () => void;
  expireParticle: (id: string) => void;
  /** Overrides the resting state while the pet is busy. Null means resting. */
  activity: PetAnimationState | null;
  throwFood: (aim?: ThrowAim) => void;
  busy: boolean;
}>;

/**
 * The piles already owed at launch, scattered across the floor.
 *
 * Ids are prefixed differently from the ones the running loop mints, so a seeded
 * pile and a freshly dropped one can never collide on a key.
 */
function seedPiles(
  cleanliness: number,
  maxLandingY: number,
): readonly PoopPile[] {
  const owed = poopPileCount(cleanliness, hygiene);
  const seeded: PoopPile[] = [];

  for (let index = 0; index < owed; index += 1) {
    const spot = randomFloorSpot(boundsFor(maxLandingY), Math.random);
    seeded.push({
      id: `pile-seed-${index}`,
      scale: 0.86 + Math.random() * 0.3,
      x: spot.x,
      y: spot.y,
    });
  }

  return seeded;
}

export function useHabitatLoop({
  pet,
  onPetChange,
  maxLandingY = DEFAULT_LANDING_MAX_Y,
  asleep = false,
}: {
  pet: Pet;
  onPetChange: (next: Pet) => void;
  /**
   * The deepest point food and the dumpling may occupy, as a fraction of the floor
   * band. Supplied by the screen because only it knows how much of the floor the
   * action wheel covers.
   */
  maxLandingY?: number;
  /**
   * True while the dumpling is out: spent stamina, or inside its quiet hours.
   *
   * Supplied by the screen rather than derived here because only half of it is a
   * need — quiet hours are a wall-clock question, and the domain deliberately keeps
   * wall-clock time out of the loop. The habitat goes still while this holds, so the
   * dumpling is not hopping around behind its own Do Not Disturb sign.
   */
  asleep?: boolean;
}): HabitatLoop {
  const [food, setFood] = useState<readonly ThrownFood[]>([]);
  const [petX, setPetX] = useState(0.5);
  const [petY, setPetY] = useState(0.42);
  /**
   * Messes that landed while the app was closed are already on the floor at the
   * first render.
   *
   * Seeded here rather than in an effect because they genuinely are initial state:
   * the dumpling did this hours ago. Animating a queue of walk-and-squat sequences
   * on launch would be both slow and a lie, and only deficits that appear during
   * the session get the animation.
   */
  const [piles, setPiles] = useState<readonly PoopPile[]>(() =>
    seedPiles(pet.needs.cleanliness, maxLandingY),
  );
  const [particles, setParticles] = useState<readonly Particle[]>([]);
  const [activity, setActivity] = useState<PetAnimationState | null>(null);

  /**
   * Mutable scratch for the async loop.
   *
   * Seeded with literals only, never with props — a ref initialised from render
   * values is treated as frozen, and this one has to be written from timers.
   */
  const scratch = useRef({
    asleep: false,
    busy: false,
    /** When `busy` was last set, for the watchdog in the heartbeat. */
    busySince: 0,
    lastBehavior: null as Behavior | null,
    food: [] as readonly ThrownFood[],
    maxLandingY: DEFAULT_LANDING_MAX_Y,
    petX: 0.5,
    petY: 0.42,
    particleSeq: 0,
    scrubDistance: 0,
    scrubLastX: 0,
    scrubLastY: 0,
    scrubPileId: '',
    pileSeq: 0,
    piles: [] as readonly PoopPile[],
    rubDistance: 0,
    rubLastX: 0,
    rubLastY: 0,
    sleepRecoveryPending: false,
    throwSeq: 0,
  });

  // Latest props, mirrored for the async loop. Assigned in an effect, never during
  // render, and read only from timers and frame callbacks.
  const petRef = useRef<Pet | null>(null);
  const changeRef = useRef<((next: Pet) => void) | null>(null);

  useEffect(() => {
    petRef.current = pet;
    changeRef.current = onPetChange;
  }, [onPetChange, pet]);

  useEffect(() => {
    scratch.current.food = food;
  }, [food]);

  useEffect(() => {
    scratch.current.petX = petX;
  }, [petX]);

  useEffect(() => {
    scratch.current.petY = petY;
  }, [petY]);

  useEffect(() => {
    scratch.current.piles = piles;
  }, [piles]);

  useEffect(() => {
    scratch.current.maxLandingY = maxLandingY;
  }, [maxLandingY]);

  useEffect(() => {
    scratch.current.asleep = asleep;
  }, [asleep]);

  // Frames and timers in flight, so unmounting cannot leave the pet mid-walk.
  const pending = useRef<{
    frame: number | null;
    timers: ReturnType<typeof setTimeout>[];
  }>({ frame: null, timers: [] });

  useEffect(
    () => () => {
      if (pending.current.frame !== null) {
        cancelAnimationFrame(pending.current.frame);
      }
      pending.current.timers.forEach(clearTimeout);
      pending.current.timers = [];
    },
    [],
  );

  const later = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      pending.current.timers = pending.current.timers.filter(
        (entry) => entry !== timer,
      );
      fn();
    }, ms);
    pending.current.timers.push(timer);
  }, []);

  /** Indirection so a finished task can start the next one without recursing. */
  const pumpRef = useRef<() => void>(() => {});

  /**
   * Zero energy interrupts movement immediately and starts one uninterrupted nap.
   * Recovery uses the existing domain `rest` action so it follows the same clamping,
   * revision, and eventual sync path as every other care mutation.
   */
  useEffect(() => {
    if (!isFullyExhausted(pet.needs)) {
      scratch.current.sleepRecoveryPending = false;
      return;
    }

    if (pending.current.frame !== null) {
      cancelAnimationFrame(pending.current.frame);
      pending.current.frame = null;
    }
    scratch.current.busy = false;

    if (scratch.current.sleepRecoveryPending) {
      return;
    }
    scratch.current.sleepRecoveryPending = true;

    later(() => {
      setActivity(null);

      const sleepingPet = petRef.current;
      if (sleepingPet !== null && isFullyExhausted(sleepingPet.needs)) {
        changeRef.current?.(
          applyCare(sleepingPet, {
            action: 'rest',
            atMs: Date.now(),
            tuning: PROVISIONAL_CARE_TUNING,
          }),
        );
      }
      scratch.current.sleepRecoveryPending = false;
      later(() => pumpRef.current(), 500);
    }, FULL_SLEEP_RECOVERY_MS);
  }, [later, pet.needs]);

  /** Walks the dumpling to a spot on the floor, then runs `onArrive`. */
  const walkTo = useCallback(
    (toX: number, toY: number, onArrive: () => void) => {
      const startX = scratch.current.petX;
      const startY = scratch.current.petY;
      // Depth reads as less travel than width does, so weight it lighter.
      const reach = Math.hypot(toX - startX, (toY - startY) * 0.6);
      const durationMs = Math.max(MIN_WALK_MS, reach * WALK_MS_PER_FRACTION);
      const startedAt = Date.now();

      setActivity('walk');

      const step = () => {
        const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
        setPetX(startX + (toX - startX) * progress);
        setPetY(startY + (toY - startY) * progress);

        if (progress < 1) {
          pending.current.frame = requestAnimationFrame(step);
          return;
        }

        pending.current.frame = null;
        onArrive();
      };

      pending.current.frame = requestAnimationFrame(step);
    },
    [],
  );

  /**
   * Wander off and leave a mess.
   *
   * Cleanliness stays the source of truth for how many piles exist; this only
   * materialises them, somewhere the pet actually walked to. A pile appearing under
   * the dumpling the instant it swallows read as a bug, which is why the schedule
   * that drives this lives on the `Pet` and lands minutes later.
   *
   * Decides nothing about what runs next. `pump` owns that.
   */
  const doRelieve = useCallback(
    (onDone: () => void) => {
      const spot = randomFloorSpot(
        boundsFor(scratch.current.maxLandingY),
        Math.random,
      );

      walkTo(spot.x, spot.y, () => {
        scratch.current.pileSeq += 1;
        const pile: PoopPile = {
          id: `pile-${scratch.current.pileSeq}`,
          scale: 0.86 + Math.random() * 0.3,
          x: spot.x,
          y: spot.y,
        };

        scratch.current.piles = [...scratch.current.piles, pile];
        setPiles((current) => [...current, pile]);
        setActivity('dirty');

        later(() => {
          setActivity(null);
          onDone();
        }, RELIEVE_SETTLE_MS);
      });
    },
    [later, walkTo],
  );

  /**
   * One ambient behavior from the domain's picker: an expression, a bob, a hop, a
   * nap, or a short walk. Care always outranks this, so `pump` only reaches it when
   * there is genuinely nothing to do.
   */
  const doAmbient = useCallback(
    (onDone: () => void) => {
      const currentPet = petRef.current;
      if (currentPet === null) {
        onDone();
        return;
      }

      const behavior = pickNextBehavior({
        lastBehavior: scratch.current.lastBehavior,
        needs: currentPet.needs,
        random: systemRandom,
      });
      scratch.current.lastBehavior = behavior;

      const travelDirection =
        behavior === 'waddle-left'
          ? -1
          : behavior === 'waddle-right'
            ? 1
            : behavior === 'pace' || behavior === 'sprint'
              ? systemRandom.next() < 0.5
                ? -1
                : 1
              : 0;

      const settle = () => {
        setActivity(
          travelDirection === 0 ? animationStateForBehavior(behavior) : null,
        );
        later(
          () => {
            setActivity(null);
            onDone();
          },
          travelDirection === 0 ? behaviorDurationMs(behavior) : 420,
        );
      };

      if (travelDirection !== 0) {
        const distance =
          behavior === 'sprint' ? 0.32 : behavior === 'pace' ? 0.24 : 0.16;
        const bounds = boundsFor(scratch.current.maxLandingY);
        const targetX = Math.min(
          bounds.maxX,
          Math.max(
            bounds.minX,
            scratch.current.petX + travelDirection * distance,
          ),
        );
        const targetY = Math.min(
          bounds.maxY,
          Math.max(
            bounds.minY,
            scratch.current.petY + (systemRandom.next() - 0.5) * 0.2,
          ),
        );
        walkTo(targetX, targetY, settle);
        return;
      }

      settle();
    },
    [later, walkTo],
  );

  /**
   * A scheduled mess came due while the app was open. Nudging the pump makes the
   * dumpling react now rather than on the next heartbeat.
   *
   * Launch messes never reach here: they are already in the initial state, so owed
   * and present agree on the first pass.
   */
  useEffect(() => {
    if (
      poopPileCount(pet.needs.cleanliness, hygiene) >
      scratch.current.piles.length
    ) {
      pumpRef.current();
    }
  }, [pet.needs.cleanliness]);

  const expireParticle = useCallback((id: string) => {
    setParticles((current) => current.filter((entry) => entry.id !== id));
  }, []);

  /** Spawns a burst of floating feedback at a point on the floor. */
  const spawnParticles = useCallback(
    (kind: Particle['kind'], count: number, x: number, y: number) => {
      const spawned: Particle[] = [];

      for (let index = 0; index < count; index += 1) {
        scratch.current.particleSeq += 1;
        spawned.push({
          drift: (Math.random() - 0.5) * 54,
          id: `particle-${scratch.current.particleSeq}`,
          kind,
          scale: 0.8 + Math.random() * 0.5,
          x: x + (Math.random() - 0.5) * 0.14,
          y: Math.max(0.02, y),
        });
      }

      setParticles((current) => [...current, ...spawned]);
    },
    [],
  );

  /**
   * Falling asleep drops whatever was in flight.
   *
   * Without this the dumpling keeps waddling through its quiet hours, because nothing
   * about the wall clock is visible to `pump` until the next task boundary. Clearing
   * the activity too means it does not resume mid-stride hours later on waking.
   */
  useEffect(() => {
    if (!asleep) {
      return;
    }

    if (pending.current.frame !== null) {
      cancelAnimationFrame(pending.current.frame);
      pending.current.frame = null;
    }
    scratch.current.busy = false;

    // The pose is dropped on a timer rather than here. Setting state synchronously in
    // an effect body cascades a render, and this file already routes every other such
    // clear through a timer for the same reason.
    const settle = setTimeout(() => setActivity(null), 0);

    return () => clearTimeout(settle);
  }, [asleep]);

  /**
   * The `zzz` drifting off a sleeping dumpling.
   *
   * This is what the sleepy particle is for. It reads as breathing rather than as
   * feedback, so it runs on its own slow cadence instead of on the pump's heartbeat,
   * and the first one lands immediately so falling asleep is visibly a transition.
   */
  useEffect(() => {
    if (!asleep) {
      return;
    }

    const puff = () => {
      spawnParticles(
        'sleepy',
        1,
        scratch.current.petX,
        Math.max(0.02, scratch.current.petY - 0.1),
      );
    };

    // The first one is a timer too, for the same reason the pose clear above is:
    // spawning straight from the effect body would cascade a render.
    const first = setTimeout(puff, 0);
    const drift = setInterval(puff, SLEEP_PUFF_MS);

    return () => {
      clearTimeout(first);
      clearInterval(drift);
    };
  }, [asleep, spawnParticles]);

  /**
   * One round of attention.
   *
   * The domain decides whether it lands at all: a mess on the floor blocks it, so
   * does an empty stamina bar, and a dumpling that is already as content as it gets
   * gains nothing. Each of those gets its own reaction, because the reaction is the
   * only feedback there is — none of them has a meter.
   */
  const applyAttention = useCallback(() => {
    const currentPet = petRef.current;
    if (currentPet === null || isFullyExhausted(currentPet.needs)) {
      return;
    }

    const messCount = poopPileCount(currentPet.needs.cleanliness, hygiene);
    const outcome = attentionOutcomeFor(
      currentPet.needs,
      PROVISIONAL_CARE_TUNING,
      { messCount },
    );

    setActivity(attentionAnimationStateFor(outcome.blockedBy));

    changeRef.current?.(
      applyCare(currentPet, {
        action: 'attention',
        atMs: Date.now(),
        tuning: PROVISIONAL_CARE_TUNING,
        context: { messCount },
      }),
    );

    const feedback = ATTENTION_PARTICLES[outcome.blockedBy];
    spawnParticles(
      feedback.kind,
      feedback.count,
      scratch.current.petX,
      Math.max(0.02, scratch.current.petY - 0.08),
    );

    later(() => setActivity(null), ATTENTION_SETTLE_MS);
  }, [later, spawnParticles]);

  const beginRub = useCallback(() => {
    scratch.current.rubLastX = 0;
    scratch.current.rubLastY = 0;
  }, []);

  /**
   * Turns the gesture's running displacement into path length, and pays out a round
   * of attention each time enough of it accumulates.
   *
   * Path length rather than displacement: rubbing back and forth returns the finger
   * to roughly where it started, so displacement alone would never reach the
   * threshold no matter how long the player rubbed.
   */
  const scrubMoveRef = useRef<(id: string, dx: number, dy: number) => void>(
    () => {},
  );

  const rubMove = useCallback(
    (dx: number, dy: number) => {
      const stepX = dx - scratch.current.rubLastX;
      const stepY = dy - scratch.current.rubLastY;
      scratch.current.rubLastX = dx;
      scratch.current.rubLastY = dy;

      if (scratch.current.busy) {
        return;
      }

      scratch.current.rubDistance += Math.hypot(stepX, stepY);
      if (scratch.current.rubDistance < RUB_DISTANCE_PER_ROUND) {
        return;
      }

      scratch.current.rubDistance = 0;
      applyAttention();
    },
    [applyAttention],
  );

  const beginScrub = useCallback((pileId: string) => {
    // Switching messes mid-clean starts that one from scratch rather than carrying
    // progress across, which would let a flick clear a pile it barely touched.
    if (scratch.current.scrubPileId !== pileId) {
      scratch.current.scrubDistance = 0;
    }
    scratch.current.scrubPileId = pileId;
    scratch.current.scrubLastX = 0;
    scratch.current.scrubLastY = 0;
  }, []);

  const removePile = useCallback((id: string) => {
    scratch.current.piles = scratch.current.piles.filter(
      (entry) => entry.id !== id,
    );
    setPiles((current) => current.filter((entry) => entry.id !== id));

    const currentPet = petRef.current;
    if (currentPet === null) {
      return;
    }

    changeRef.current?.(
      withRevision(currentPet, {
        needs: {
          ...currentPet.needs,
          cleanliness: cleanlinessAfterTap(
            currentPet.needs.cleanliness,
            hygiene,
          ),
        },
      }),
    );
  }, []);

  /**
   * Walk to the next landed item and eat it. `pump` has already established that
   * there is one to walk to.
   */
  const doEat = useCallback(
    (onDone: () => void) => {
      const currentPet = petRef.current;
      const landed = scratch.current.food.filter(
        (entry) => entry.phase === 'landed',
      );

      if (currentPet === null || landed.length === 0) {
        onDone();
        return;
      }

      const order = sortFoodByPreference(
        landed.map((entry) => entry.item),
        resolvedFavoriteFood(currentPet),
      );
      const target =
        landed.find((entry) => entry.item === order[0]) ?? landed[0];
      if (target === undefined) {
        onDone();
        return;
      }

      walkTo(target.x, target.y, () => {
        // Arrived. Hunger and stamina update here, the meal's mess is scheduled
        // for later, and overfeeding costs happiness through the domain rule
        // rather than through a refusal.
        const eating = petRef.current;
        if (eating !== null) {
          const wasted = wastedHungerFor(eating.needs, PROVISIONAL_CARE_TUNING);
          setActivity(wasted > 0 ? 'sick' : 'eat');

          changeRef.current?.(
            feedPet(eating, {
              atMs: Date.now(),
              tuning: PROVISIONAL_CARE_TUNING,
              messConfig: PROVISIONAL_MESS_CONFIG,
              random: systemRandom,
            }),
          );
        }

        scratch.current.food = scratch.current.food.filter(
          (entry) => entry.id !== target.id,
        );
        setFood((current) => current.filter((entry) => entry.id !== target.id));

        later(() => {
          setActivity(null);
          onDone();
        }, EAT_MS);
      });
    },
    [later, walkTo],
  );

  /**
   * The one place work starts.
   *
   * Every task — eating, leaving a mess, idling — is chosen here in priority order
   * from current state. Nothing else sets the busy flag, and nothing else decides
   * what happens next: a task reports completion and the pump runs again.
   *
   * This shape exists because the previous one lost food. Work was kicked off from
   * seven places, each firing once and trusting something else to notice if it could
   * not run, and a meal that landed while the dumpling was mid-behavior was left on
   * the floor forever. With a single entry point that is not expressible — a task
   * that cannot start now is simply still the highest-priority task next time.
   *
   * Tasks are derived from state rather than kept in a list, deliberately. A stored
   * queue can hold an entry for food that has already been eaten or a mess that has
   * already been scrubbed, and then the runner has to decide what a stale entry
   * means. Deriving cannot go stale.
   */
  const pump = useCallback(() => {
    const currentPet = petRef.current;
    if (currentPet === null || scratch.current.busy) {
      return;
    }

    // A sleeping dumpling does nothing at all. At zero energy the recovery effect
    // owns waking it and pumps when the nap is finished; through quiet hours the
    // screen lowers `asleep` and the heartbeat picks the habitat back up.
    if (scratch.current.asleep || isFullyExhausted(currentPet.needs)) {
      return;
    }

    const start = (task: (onDone: () => void) => void) => {
      scratch.current.busy = true;
      scratch.current.busySince = Date.now();
      task(() => {
        scratch.current.busy = false;
        pumpRef.current();
      });
    };

    // Food outranks everything. Anything already on the floor gets eaten first.
    if (scratch.current.food.some((entry) => entry.phase === 'landed')) {
      start(doEat);
      return;
    }

    // Something is still in the air: wait for it rather than wandering off. Its
    // landing timer pumps again.
    if (scratch.current.food.length > 0) {
      return;
    }

    if (
      poopPileCount(currentPet.needs.cleanliness, hygiene) >
      scratch.current.piles.length
    ) {
      start(doRelieve);
      return;
    }

    start(doAmbient);
  }, [doAmbient, doEat, doRelieve]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  /**
   * The backstop, and the watchdog.
   *
   * Tasks pump on completion, so this is not the normal path — it is what makes a
   * dropped task a hiccup instead of a permanent stall. Two things it catches: work
   * that was skipped because the dumpling happened to be busy at the wrong moment,
   * and a task that never reported completion at all, which would otherwise hold the
   * busy flag forever and freeze the habitat until relaunch.
   *
   * The watchdog ceiling is far longer than any real task, so it can only fire on a
   * genuine fault rather than papering over slow ones.
   */
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (
        scratch.current.busy &&
        Date.now() - scratch.current.busySince > STUCK_TASK_MS
      ) {
        scratch.current.busy = false;
        setActivity(null);
      }

      pumpRef.current();
    }, PUMP_HEARTBEAT_MS);

    return () => clearInterval(heartbeat);
  }, []);

  useEffect(() => {
    later(() => pumpRef.current(), 1400);
  }, [later]);

  const throwFood = useCallback(
    (aim?: ThrowAim) => {
      const currentPet = petRef.current;
      // A dumpling that has conked out does not get up for food. It wakes on its
      // own, and eating is what refills stamina once it has. The same goes for its
      // quiet hours: a meal thrown at 3am would otherwise sit on the floor till dawn.
      if (
        currentPet === null ||
        scratch.current.asleep ||
        isFullyExhausted(currentPet.needs)
      ) {
        return;
      }

      scratch.current.throwSeq += 1;

      const landing = landingFor(
        aim ?? null,
        boundsFor(scratch.current.maxLandingY),
        () => systemRandom.next(),
      );

      const thrown: ThrownFood = {
        id: `throw-${scratch.current.throwSeq}`,
        item: pickFoodItem(currentPet.diet, systemRandom),
        phase: 'flying',
        x: landing.x,
        y: landing.y,
      };

      setFood((current) => [...current, thrown]);
      scratch.current.food = [...scratch.current.food, thrown];

      // Landing is a timer, not a physics result: the arc is decoration, and the pet
      // must not start walking toward something still in the air.
      later(() => {
        const land = (entry: ThrownFood): ThrownFood =>
          entry.id === thrown.id ? { ...entry, phase: 'landed' } : entry;

        scratch.current.food = scratch.current.food.map(land);
        setFood((current) => current.map(land));
        pumpRef.current();
      }, FLIGHT_MS);
    },
    [later],
  );

  /**
   * Scrubbing a mess: the same path-length gesture as petting, paying out in bubbles
   * and finally in the mess being gone. Tapping still clears one outright, which is
   * the accessible path.
   */
  const scrubMove = useCallback(
    (pileId: string, dx: number, dy: number) => {
      const stepX = dx - scratch.current.scrubLastX;
      const stepY = dy - scratch.current.scrubLastY;
      scratch.current.scrubLastX = dx;
      scratch.current.scrubLastY = dy;

      if (scratch.current.scrubPileId !== pileId) {
        return;
      }

      const before = scratch.current.scrubDistance;
      scratch.current.scrubDistance += Math.hypot(stepX, stepY);

      const pile = scratch.current.piles.find((entry) => entry.id === pileId);
      if (pile === undefined) {
        return;
      }

      // A bubble every so often, so the effort reads as progress rather than as
      // nothing happening until it suddenly vanishes.
      if (
        Math.floor(before / 34) !==
        Math.floor(scratch.current.scrubDistance / 34)
      ) {
        spawnParticles('bubble', 1, pile.x, Math.max(0.02, pile.y - 0.04));
      }

      if (scratch.current.scrubDistance < SCRUB_DISTANCE_PER_PILE) {
        return;
      }

      scratch.current.scrubDistance = 0;
      scratch.current.scrubPileId = '';
      spawnParticles('bubble', 3, pile.x, Math.max(0.02, pile.y - 0.04));
      removePile(pileId);
    },
    [removePile, spawnParticles],
  );

  useEffect(() => {
    scrubMoveRef.current = scrubMove;
  }, [scrubMove]);

  return {
    activity,
    beginRub,
    beginScrub,
    busy: activity !== null,
    expireParticle,
    food,
    particles,
    petOnce: applyAttention,
    petX,
    petY,
    piles,
    removePile,
    rubMove,
    scrubMove,
    throwFood,
  };
}
