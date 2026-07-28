import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SLEEP_SCHEDULE,
  describeSleepSchedule,
  fixedOffsetLocalTime,
  formatMinuteOfDay,
  isAsleepAt,
  isAsleepAtMinute,
  MINUTES_PER_DAY,
  normalizeMinuteOfDay,
  normalizeSleepSchedule,
  sleepWindowMinutes,
  systemLocalTime,
  type SleepSchedule,
} from './sleep-schedule';

const at = (hour: number, minute = 0) => hour * 60 + minute;

/** The default, and the shape that matters: a window crossing midnight. */
const overnight: SleepSchedule = DEFAULT_SLEEP_SCHEDULE;
/** A daytime nap window, which does not wrap. */
const daytime: SleepSchedule = {
  startMinuteOfDay: at(13),
  endMinuteOfDay: at(15),
};

describe('isAsleepAtMinute', () => {
  it('sleeps through a window that crosses midnight', () => {
    // 22:00 to 07:00 — the normal case, not the edge case.
    expect(isAsleepAtMinute(overnight, at(23))).toBe(true);
    expect(isAsleepAtMinute(overnight, at(0))).toBe(true);
    expect(isAsleepAtMinute(overnight, at(3, 30))).toBe(true);
    expect(isAsleepAtMinute(overnight, at(6, 59))).toBe(true);
  });

  it('is awake outside a window that crosses midnight', () => {
    expect(isAsleepAtMinute(overnight, at(7))).toBe(false);
    expect(isAsleepAtMinute(overnight, at(12))).toBe(false);
    expect(isAsleepAtMinute(overnight, at(21, 59))).toBe(false);
  });

  it('includes the start minute and excludes the end minute', () => {
    // Half-open, so a window cannot double-count the boundary minute.
    expect(isAsleepAtMinute(overnight, at(22))).toBe(true);
    expect(isAsleepAtMinute(overnight, at(7))).toBe(false);
  });

  it('handles a window that does not wrap', () => {
    expect(isAsleepAtMinute(daytime, at(14))).toBe(true);
    expect(isAsleepAtMinute(daytime, at(12, 59))).toBe(false);
    expect(isAsleepAtMinute(daytime, at(15))).toBe(false);
    expect(isAsleepAtMinute(daytime, at(2))).toBe(false);
  });

  it('never sleeps on a zero-length window', () => {
    // The safe reading. Interpreting it as "always asleep" would freeze the game
    // forever from one bad stored value.
    const none: SleepSchedule = {
      startMinuteOfDay: at(9),
      endMinuteOfDay: at(9),
    };

    for (let minute = 0; minute < MINUTES_PER_DAY; minute += 37) {
      expect(isAsleepAtMinute(none, minute)).toBe(false);
    }
  });

  it('covers exactly the whole day when the window is one minute short of it', () => {
    const almostAll: SleepSchedule = {
      startMinuteOfDay: at(9),
      endMinuteOfDay: at(8, 59),
    };
    let asleep = 0;

    for (let minute = 0; minute < MINUTES_PER_DAY; minute += 1) {
      if (isAsleepAtMinute(almostAll, minute)) {
        asleep += 1;
      }
    }

    expect(asleep).toBe(MINUTES_PER_DAY - 1);
  });

  it('normalizes out-of-range minutes rather than misreading them', () => {
    expect(isAsleepAtMinute(overnight, at(23) + MINUTES_PER_DAY)).toBe(true);
    expect(isAsleepAtMinute(overnight, -60)).toBe(true);
  });
});

describe('sleepWindowMinutes', () => {
  it('measures a wrapped window across midnight', () => {
    expect(sleepWindowMinutes(overnight)).toBe(9 * 60);
  });

  it('measures a same-day window', () => {
    expect(sleepWindowMinutes(daytime)).toBe(2 * 60);
  });

  it('is zero when start and end agree', () => {
    expect(
      sleepWindowMinutes({ startMinuteOfDay: at(9), endMinuteOfDay: at(9) }),
    ).toBe(0);
  });

  it('agrees with counting the minutes one by one', () => {
    for (const schedule of [overnight, daytime]) {
      let counted = 0;
      for (let minute = 0; minute < MINUTES_PER_DAY; minute += 1) {
        if (isAsleepAtMinute(schedule, minute)) {
          counted += 1;
        }
      }
      expect(counted).toBe(sleepWindowMinutes(schedule));
    }
  });
});

describe('normalizeSleepSchedule and normalizeMinuteOfDay', () => {
  it('wraps values past the end of the day', () => {
    expect(normalizeMinuteOfDay(MINUTES_PER_DAY + 90)).toBe(90);
  });

  it('wraps negative values forward instead of leaving them negative', () => {
    expect(normalizeMinuteOfDay(-1)).toBe(MINUTES_PER_DAY - 1);
  });

  it('falls back to midnight for a non-finite value', () => {
    expect(normalizeMinuteOfDay(Number.NaN)).toBe(0);
  });

  it('normalizes both ends of a schedule', () => {
    expect(
      normalizeSleepSchedule({
        startMinuteOfDay: MINUTES_PER_DAY + at(22),
        endMinuteOfDay: -at(17),
      }),
    ).toEqual({ startMinuteOfDay: at(22), endMinuteOfDay: at(7) });
  });
});

describe('isAsleepAt', () => {
  it('reads the hour through the injected local time, not the machine timezone', () => {
    // Same instant, two timezones, opposite answers. This is exactly why the
    // conversion is a port rather than a bare `new Date()`.
    const midnightUtc = Date.UTC(2026, 0, 2, 0, 0, 0);

    expect(isAsleepAt(overnight, midnightUtc, fixedOffsetLocalTime(0))).toBe(
      true,
    );
    expect(
      // +10 hours puts local time at 10:00, wide awake.
      isAsleepAt(overnight, midnightUtc, fixedOffsetLocalTime(10 * 60)),
    ).toBe(false);
  });
});

describe('systemLocalTime', () => {
  it('reports a minute of day inside the day', () => {
    const minute = systemLocalTime.minuteOfDayAt(Date.UTC(2026, 0, 2, 9, 30));

    expect(minute).toBeGreaterThanOrEqual(0);
    expect(minute).toBeLessThan(MINUTES_PER_DAY);
    expect(Number.isInteger(minute)).toBe(true);
  });
});

describe('formatting', () => {
  it.each([
    [0, '00:00'],
    [at(7), '07:00'],
    [at(13, 5), '13:05'],
    [at(23, 59), '23:59'],
  ])('renders %s as %s', (minute, expected) => {
    expect(formatMinuteOfDay(minute)).toBe(expected);
  });

  it('describes a window for settings and screen readers', () => {
    expect(describeSleepSchedule(overnight)).toBe('22:00 to 07:00');
  });
});
