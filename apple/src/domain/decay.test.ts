import { describe, expect, it } from 'vitest';

import { createTestPet, needs } from './__fixtures__/pet';
import { createAdvanceableClock, MS_PER_MINUTE } from './clock';
import {
  advancePet,
  applyElapsedDecay,
  decayNeeds,
  elapsedMinutesBetween,
  PROVISIONAL_DECAY_CONFIG,
  PROVISIONAL_DECAY_RATES,
  type AdvanceConfig,
} from './decay';
import { PROVISIONAL_HYGIENE_CONFIG } from './hygiene';
import { PROVISIONAL_MESS_CONFIG } from './messes';
import { DEFAULT_SLEEP_SCHEDULE, fixedOffsetLocalTime } from './sleep-schedule';
import { NEED_MAX, NEED_MIN } from './needs';

const rates = PROVISIONAL_DECAY_RATES;
const config = PROVISIONAL_DECAY_CONFIG;
const START_MS = Date.UTC(2026, 0, 1, 12, 0, 0);

const advanceConfig: AdvanceConfig = {
  decay: config,
  hygiene: PROVISIONAL_HYGIENE_CONFIG,
  mess: PROVISIONAL_MESS_CONFIG,
  // Pinned to UTC so the walk's local-hour decisions are the same everywhere.
  localTime: fixedOffsetLocalTime(0),
};

describe('elapsedMinutesBetween', () => {
  it.each([
    [0, 0],
    [59_000, 0],
    [60_000, 1],
    [90_000, 1],
    [600_000, 10],
  ])('%sms of span is %s whole minutes', (spanMs, expected) => {
    expect(elapsedMinutesBetween(START_MS, START_MS + spanMs)).toBe(expected);
  });

  it('returns zero when the clock moved backwards', () => {
    expect(elapsedMinutesBetween(START_MS, START_MS - 600_000)).toBe(0);
  });

  it('returns zero for non-finite timestamps', () => {
    expect(elapsedMinutesBetween(Number.NaN, START_MS)).toBe(0);
    expect(elapsedMinutesBetween(START_MS, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('decayNeeds', () => {
  it('drains hunger and happiness while energy recovers', () => {
    // 0.15/min hunger and 0.1/min happiness, both floored, over ten minutes.
    expect(decayNeeds(needs(), 10, rates)).toEqual(
      needs({ hunger: 79, cleanliness: 80, energy: 90, happiness: 79 }),
    );
  });

  it('never moves cleanliness, which only meals and scrubbing change', () => {
    const result = decayNeeds(needs({ cleanliness: 40 }), 600, rates);
    expect(result.cleanliness).toBe(40);
  });

  it('recovers energy rather than draining it, which is what clears sleep', () => {
    const exhausted = needs({ energy: 0 });
    expect(decayNeeds(exhausted, 30, rates).energy).toBe(30);
  });

  it('caps energy recovery at the maximum', () => {
    expect(decayNeeds(needs({ energy: 95 }), 600, rates).energy).toBe(NEED_MAX);
  });

  it('charges extra happiness for each mess left in the habitat', () => {
    const clean = decayNeeds(needs(), 20, rates, 0);
    const filthy = decayNeeds(needs(), 20, rates, 4);

    // 0.1/min baseline over 20 minutes, plus 0.1/min for each of four messes:
    // a filthy habitat drains happiness five times as fast as a clean one.
    expect(clean.happiness).toBe(78);
    expect(filthy.happiness).toBe(70);
  });

  it('floors a fractional rate rather than rounding up', () => {
    // 0.2/min with one mess: nothing at all after a minute, one point after five.
    expect(decayNeeds(needs(), 1, rates, 1).happiness).toBe(80);
    expect(decayNeeds(needs(), 5, rates, 1).happiness).toBe(79);
  });

  it('returns the input unchanged for zero or negative minutes', () => {
    const input = needs();
    expect(decayNeeds(input, 0, rates)).toBe(input);
    expect(decayNeeds(input, -5, rates)).toBe(input);
  });

  it('floors at the minimum rather than going negative', () => {
    const result = decayNeeds(needs({ hunger: 3 }), 2_000, rates);
    expect(result.hunger).toBe(NEED_MIN);
    expect(result.happiness).toBe(NEED_MIN);
  });
});

describe('applyElapsedDecay', () => {
  it('bills the elapsed span while the clock advances', () => {
    const clock = createAdvanceableClock(START_MS);
    const from = clock.now();
    clock.advanceMinutes(30);

    const result = applyElapsedDecay(needs(), {
      fromMs: from,
      toMs: clock.now(),
      config,
    });

    expect(result.appliedMinutes).toBe(30);
    expect(result.forgivenMinutes).toBe(0);
    expect(result.wasCapped).toBe(false);
    expect(result.wasClockSkewed).toBe(false);
    expect(result.needs).toEqual(
      needs({ hunger: 76, cleanliness: 80, energy: 100, happiness: 77 }),
    );
  });

  it('caps a long absence and reports the forgiven minutes', () => {
    const absentMinutes = config.offlineCatchUpCapMinutes + 5_000;

    const result = applyElapsedDecay(needs(), {
      fromMs: START_MS,
      toMs: START_MS + absentMinutes * MS_PER_MINUTE,
      config,
    });

    expect(result.appliedMinutes).toBe(config.offlineCatchUpCapMinutes);
    expect(result.forgivenMinutes).toBe(5_000);
    expect(result.wasCapped).toBe(true);
  });

  it('grants nothing back when the device clock jumped backwards', () => {
    const input = needs({ hunger: 30 });

    const result = applyElapsedDecay(input, {
      fromMs: START_MS,
      toMs: START_MS - 7 * 24 * 60 * MS_PER_MINUTE,
      config,
    });

    expect(result.appliedMinutes).toBe(0);
    expect(result.wasClockSkewed).toBe(true);
    expect(result.needs).toEqual(input);
  });

  it.each([1, 60, 720, 10_000, 1_000_000])(
    'keeps every need inside 0-100 after %s minutes',
    (minutes) => {
      const result = applyElapsedDecay(needs(), {
        fromMs: START_MS,
        toMs: START_MS + minutes * MS_PER_MINUTE,
        config,
        messCount: 5,
      });

      for (const value of Object.values(result.needs)) {
        expect(value).toBeGreaterThanOrEqual(NEED_MIN);
        expect(value).toBeLessThanOrEqual(NEED_MAX);
        expect(Number.isInteger(value)).toBe(true);
      }
    },
  );

  it('treats a zero cap as full forgiveness', () => {
    const input = needs();

    const result = applyElapsedDecay(input, {
      fromMs: START_MS,
      toMs: START_MS + 600 * MS_PER_MINUTE,
      config: { ...config, offlineCatchUpCapMinutes: 0 },
    });

    expect(result.appliedMinutes).toBe(0);
    expect(result.wasCapped).toBe(true);
    expect(result.needs).toEqual(input);
  });

  it('uses injected rates rather than a hard-coded schedule', () => {
    const result = applyElapsedDecay(needs(), {
      fromMs: START_MS,
      toMs: START_MS + 60 * MS_PER_MINUTE,
      config: {
        offlineCatchUpCapMinutes: 10_000,
        rates: {
          hungerPerMinute: 0.1,
          happinessPerMinute: 0,
          happinessPerMinutePerMess: 0,
          energyRecoveryPerMinute: 0,
        },
      },
    });

    expect(result.needs).toEqual(needs({ hunger: 74 }));
  });
});

describe('advancePet', () => {
  const at = (minutes: number) => START_MS + minutes * MS_PER_MINUTE;

  const petAt = (overrides: Parameters<typeof createTestPet>[0] = {}) =>
    createTestPet({ lastCaredAtMs: START_MS, ...overrides });

  it('returns the pet untouched when no time has passed', () => {
    const pet = petAt();
    expect(advancePet(pet, START_MS, advanceConfig).pet).toBe(pet);
  });

  it('lands a scheduled mess that came due while the app was closed', () => {
    const pet = petAt({
      needs: needs({ cleanliness: 100 }),
      pendingMessesAtMs: [at(10)],
    });

    const result = advancePet(pet, at(30), advanceConfig);

    expect(result.messesLanded).toBe(1);
    expect(result.pet.needs.cleanliness).toBe(80);
    expect(result.pet.pendingMessesAtMs).toEqual([]);
  });

  it('leaves a mess that is not due yet on the schedule', () => {
    const pet = petAt({
      needs: needs({ cleanliness: 100 }),
      pendingMessesAtMs: [at(45)],
    });

    const result = advancePet(pet, at(30), advanceConfig);

    expect(result.messesLanded).toBe(0);
    expect(result.pet.needs.cleanliness).toBe(100);
    expect(result.pet.pendingMessesAtMs).toEqual([at(45)]);
  });

  it('charges happiness only for the time a mess was actually present', () => {
    // Identical windows, but the mess lands at the very end of one and at the
    // very start of the other. Billing the whole window at one mess count would
    // make these equal.
    const late = advancePet(
      petAt({
        needs: needs({ cleanliness: 100 }),
        pendingMessesAtMs: [at(58)],
      }),
      at(60),
      advanceConfig,
    );
    const early = advancePet(
      petAt({
        needs: needs({ cleanliness: 100 }),
        pendingMessesAtMs: [at(2)],
      }),
      at(60),
      advanceConfig,
    );

    expect(early.pet.needs.happiness).toBeLessThan(late.pet.needs.happiness);
  });

  it('lands a mess forgiven by the offline cap without charging for the wait', () => {
    const capped: AdvanceConfig = {
      ...advanceConfig,
      decay: { ...config, offlineCatchUpCapMinutes: 10 },
    };
    const pet = petAt({
      needs: needs({ cleanliness: 100 }),
      pendingMessesAtMs: [at(5)],
    });

    // Due long before the billable window opens: the pile still exists, but the
    // player is not charged for the days it sat there.
    const result = advancePet(pet, at(5_000), capped);

    expect(result.wasCapped).toBe(true);
    expect(result.appliedMinutes).toBe(10);
    expect(result.messesLanded).toBe(1);
    expect(result.pet.needs.cleanliness).toBe(80);
  });

  it('lands several overdue messes in order', () => {
    const pet = petAt({
      needs: needs({ cleanliness: 100 }),
      pendingMessesAtMs: [at(5), at(10), at(15)],
    });

    const result = advancePet(pet, at(20), advanceConfig);

    expect(result.messesLanded).toBe(3);
    expect(result.pet.needs.cleanliness).toBe(40);
  });

  it('preserves identity across a catch-up', () => {
    const pet = petAt({ pendingMessesAtMs: [at(1)] });
    const result = advancePet(pet, at(90), advanceConfig);

    expect(result.pet.id).toBe(pet.id);
    expect(result.pet.bornAtMs).toBe(pet.bornAtMs);
    expect(result.pet.name).toBe(pet.name);
    expect(result.pet.unlockedSkinIds).toEqual(pet.unlockedSkinIds);
    expect(result.pet.revision).toBeGreaterThan(pet.revision);
  });

  it('moves the decay basis forward so the same span is never billed twice', () => {
    const pet = petAt();
    const once = advancePet(pet, at(60), advanceConfig).pet;
    const twice = advancePet(once, at(60), advanceConfig).pet;

    expect(once.lastCaredAtMs).toBe(at(60));
    expect(twice).toBe(once);
  });

  it('never leaves a need outside 0-100 however long the absence', () => {
    const pet = petAt({
      needs: needs({ cleanliness: 100 }),
      pendingMessesAtMs: [at(1), at(2), at(3), at(4), at(5)],
    });

    const result = advancePet(pet, at(1_000_000), advanceConfig);

    for (const value of Object.values(result.pet.needs)) {
      expect(value).toBeGreaterThanOrEqual(NEED_MIN);
      expect(value).toBeLessThanOrEqual(NEED_MAX);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('does not reward a backwards clock', () => {
    const pet = petAt({ needs: needs({ hunger: 20 }) });
    const result = advancePet(
      pet,
      START_MS - 10 * MS_PER_MINUTE,
      advanceConfig,
    );

    expect(result.wasClockSkewed).toBe(true);
    expect(result.pet.needs.hunger).toBe(20);
  });
});

/**
 * Stasis. People sleep, and a dumpling that starves overnight punishes the player
 * for having a life — so the quiet window costs nothing but still restores energy.
 */
describe('advancePet during the quiet window', () => {
  const MIDNIGHT_UTC = Date.UTC(2026, 0, 2, 0, 0, 0);
  /** 07:00 local, the moment the default window ends. */
  const WAKE_UTC = Date.UTC(2026, 0, 2, 7, 0, 0);
  const NOON_UTC = Date.UTC(2026, 0, 2, 12, 0, 0);

  const sleeper = (lastCaredAtMs: number, overrides = {}) =>
    createTestPet({
      lastCaredAtMs,
      needs: needs({ energy: 20 }),
      sleepSchedule: DEFAULT_SLEEP_SCHEDULE,
      ...overrides,
    });

  it('costs no hunger or happiness across a night', () => {
    // 01:00 to 06:00, entirely inside 22:00-07:00.
    const pet = sleeper(MIDNIGHT_UTC + 60 * MS_PER_MINUTE);
    const result = advancePet(
      pet,
      MIDNIGHT_UTC + 360 * MS_PER_MINUTE,
      advanceConfig,
    );

    expect(result.awakeMinutes).toBe(0);
    expect(result.pet.needs.hunger).toBe(pet.needs.hunger);
    expect(result.pet.needs.happiness).toBe(pet.needs.happiness);
  });

  it('still recovers energy while asleep, which is the point of sleeping', () => {
    const pet = sleeper(MIDNIGHT_UTC + 60 * MS_PER_MINUTE);
    const result = advancePet(
      pet,
      MIDNIGHT_UTC + 360 * MS_PER_MINUTE,
      advanceConfig,
    );

    expect(result.pet.needs.energy).toBeGreaterThan(pet.needs.energy);
    expect(result.pet.needs.energy).toBe(100);
  });

  it('bills only the waking half of a window that spans the wake-up time', () => {
    // 05:00 to 09:00: two hours asleep, then two hours awake.
    const pet = sleeper(WAKE_UTC - 120 * MS_PER_MINUTE);
    const result = advancePet(
      pet,
      WAKE_UTC + 120 * MS_PER_MINUTE,
      advanceConfig,
    );

    expect(result.appliedMinutes).toBe(240);
    expect(result.awakeMinutes).toBe(120);
    expect(result.pet.needs.hunger).toBe(
      80 - Math.floor(120 * PROVISIONAL_DECAY_RATES.hungerPerMinute),
    );
  });

  it('bills every minute when the whole window is in daylight', () => {
    const pet = sleeper(NOON_UTC);
    const result = advancePet(
      pet,
      NOON_UTC + 120 * MS_PER_MINUTE,
      advanceConfig,
    );

    expect(result.awakeMinutes).toBe(result.appliedMinutes);
    expect(result.awakeMinutes).toBe(120);
  });

  it('charges nothing for messes that sat there overnight', () => {
    // The mess lands, but a sleeping dumpling is not miserable about it.
    const pet = sleeper(MIDNIGHT_UTC + 30 * MS_PER_MINUTE, {
      needs: needs({ cleanliness: 100 }),
      pendingMessesAtMs: [MIDNIGHT_UTC + 60 * MS_PER_MINUTE],
    });
    const result = advancePet(
      pet,
      MIDNIGHT_UTC + 360 * MS_PER_MINUTE,
      advanceConfig,
    );

    expect(result.messesLanded).toBe(1);
    expect(result.pet.needs.cleanliness).toBe(80);
    expect(result.pet.needs.happiness).toBe(pet.needs.happiness);
  });

  it('never sleeps when the schedule is a zero-length window', () => {
    const pet = sleeper(MIDNIGHT_UTC + 60 * MS_PER_MINUTE, {
      sleepSchedule: { startMinuteOfDay: 0, endMinuteOfDay: 0 },
    });
    const result = advancePet(
      pet,
      MIDNIGHT_UTC + 360 * MS_PER_MINUTE,
      advanceConfig,
    );

    expect(result.awakeMinutes).toBe(result.appliedMinutes);
    expect(result.pet.needs.hunger).toBeLessThan(pet.needs.hunger);
  });

  it('reads the window in local time, so the same instant differs by region', () => {
    const pet = sleeper(MIDNIGHT_UTC + 60 * MS_PER_MINUTE);
    const toMs = MIDNIGHT_UTC + 360 * MS_PER_MINUTE;

    const asleep = advancePet(pet, toMs, advanceConfig);
    const awake = advancePet(pet, toMs, {
      ...advanceConfig,
      // +10 hours: 11:00 to 16:00 local, the middle of the day.
      localTime: fixedOffsetLocalTime(10 * 60),
    });

    expect(asleep.awakeMinutes).toBe(0);
    expect(awake.awakeMinutes).toBe(300);
  });

  it('makes a night free and leaves a workday hungry rather than starving', () => {
    // The two absences the schedule is actually tuned around. A dumpling fed
    // before the player leaves should be waiting, not dying.
    const full = { needs: needs({ hunger: 100, energy: 20 }) };

    const overnight = advancePet(
      sleeper(Date.UTC(2026, 0, 1, 23, 0, 0), full),
      Date.UTC(2026, 0, 2, 7, 0, 0),
      advanceConfig,
    );
    const workday = advancePet(
      sleeper(Date.UTC(2026, 0, 2, 9, 0, 0), full),
      Date.UTC(2026, 0, 2, 17, 0, 0),
      advanceConfig,
    );

    // Eight hours asleep costs nothing at all.
    expect(overnight.pet.needs.hunger).toBe(100);
    // Eight hours out costs most of the bar, and leaves room to spare.
    expect(workday.pet.needs.hunger).toBe(28);
  });

  it('takes most of a waking day to starve a full dumpling', () => {
    const pet = sleeper(Date.UTC(2026, 0, 2, 7, 0, 0), {
      needs: needs({ hunger: 100, energy: 20 }),
    });
    // 07:00 to 18:00 — eleven straight waking hours.
    const result = advancePet(
      pet,
      Date.UTC(2026, 0, 2, 18, 0, 0),
      advanceConfig,
    );

    expect(result.pet.needs.hunger).toBe(1);
  });
});
