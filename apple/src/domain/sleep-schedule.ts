/**
 * The dumpling's night.
 *
 * People sleep, and a dumpling that starves through the night punishes the player
 * for having a life. During its quiet hours the dumpling is in stasis: hunger and
 * happiness stop moving entirely, energy still recovers because that is what sleep
 * is for, and any mess a meal already scheduled still arrives — so there is a small
 * tidy-up waiting in the morning rather than a crisis.
 *
 * The window is the owner's, not the dumpling's, but it rides on the `Pet` for the
 * same reason `diet` does: it should follow the player to a second device rather
 * than being re-set on each install. There is no client-side profile model yet.
 *
 * iOS exposes no usable API for the user's actual Sleep Focus schedule — HealthKit
 * carries retrospective sleep *records*, behind an entitlement and a permission
 * prompt, and says nothing about intent. So this is a window we own, read against
 * device local time, with a default and a Settings control.
 */

export type SleepSchedule = Readonly<{
  /** Minutes after local midnight when the dumpling settles down. */
  startMinuteOfDay: number;
  /** Minutes after local midnight when it wakes. */
  endMinuteOfDay: number;
}>;

export const MINUTES_PER_DAY = 24 * 60;

/** 22:00 to 07:00 local. PROVISIONAL — the player can move it in Settings. */
export const DEFAULT_SLEEP_SCHEDULE: SleepSchedule = {
  startMinuteOfDay: 22 * 60,
  endMinuteOfDay: 7 * 60,
};

/**
 * Reading wall-clock local time from an instant.
 *
 * Injected for the same reason `Clock` is: the domain must stay testable without
 * depending on the machine's timezone, and a test that only passes in one region is
 * worse than no test.
 */
export type LocalTime = {
  /** Minutes since local midnight for the given instant. */
  minuteOfDayAt(epochMs: number): number;
};

export const systemLocalTime: LocalTime = {
  minuteOfDayAt: (epochMs: number) => {
    const date = new Date(epochMs);
    return date.getHours() * 60 + date.getMinutes();
  },
};

/** A local time pinned to one offset from UTC. Test-only convenience. */
export function fixedOffsetLocalTime(offsetMinutes: number): LocalTime {
  return {
    minuteOfDayAt: (epochMs: number) =>
      normalizeMinuteOfDay(Math.floor(epochMs / 60_000) + offsetMinutes),
  };
}

export function normalizeMinuteOfDay(minute: number): number {
  if (!Number.isFinite(minute)) {
    return 0;
  }

  return (
    ((Math.floor(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  );
}

/** Clamps a stored or user-entered schedule into real minutes of a day. */
export function normalizeSleepSchedule(schedule: SleepSchedule): SleepSchedule {
  return {
    startMinuteOfDay: normalizeMinuteOfDay(schedule.startMinuteOfDay),
    endMinuteOfDay: normalizeMinuteOfDay(schedule.endMinuteOfDay),
  };
}

/**
 * Whether the given minute of the day falls inside the quiet window.
 *
 * The usual window crosses midnight, so the wrapped case is the normal one rather
 * than the edge case. A zero-length window means the dumpling never sleeps, which
 * is the safe reading: the alternative interpretation — always asleep — would
 * freeze the game forever from one bad value.
 */
export function isAsleepAtMinute(
  schedule: SleepSchedule,
  minuteOfDay: number,
): boolean {
  const { startMinuteOfDay: start, endMinuteOfDay: end } =
    normalizeSleepSchedule(schedule);
  const minute = normalizeMinuteOfDay(minuteOfDay);

  if (start === end) {
    return false;
  }

  return start < end
    ? minute >= start && minute < end
    : minute >= start || minute < end;
}

export function isAsleepAt(
  schedule: SleepSchedule,
  epochMs: number,
  localTime: LocalTime,
): boolean {
  return isAsleepAtMinute(schedule, localTime.minuteOfDayAt(epochMs));
}

/** How long the quiet window lasts, in minutes. */
export function sleepWindowMinutes(schedule: SleepSchedule): number {
  const { startMinuteOfDay: start, endMinuteOfDay: end } =
    normalizeSleepSchedule(schedule);

  if (start === end) {
    return 0;
  }

  return start < end ? end - start : MINUTES_PER_DAY - start + end;
}

/** `HH:MM` in 24-hour form, for settings and screen readers. */
export function formatMinuteOfDay(minuteOfDay: number): string {
  const minute = normalizeMinuteOfDay(minuteOfDay);
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function describeSleepSchedule(schedule: SleepSchedule): string {
  const { startMinuteOfDay: start, endMinuteOfDay: end } =
    normalizeSleepSchedule(schedule);

  return `${formatMinuteOfDay(start)} to ${formatMinuteOfDay(end)}`;
}
