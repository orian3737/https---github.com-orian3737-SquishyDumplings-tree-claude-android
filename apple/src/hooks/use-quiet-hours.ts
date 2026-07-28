import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  isAsleepAt,
  systemClock,
  systemLocalTime,
  type SleepSchedule,
} from '@/domain';

/**
 * Whether the dumpling is inside its quiet hours right now.
 *
 * A hook rather than a bare call at render time for two reasons: reading the clock
 * during render is impure, and the answer changes on its own. Without a ticker a
 * player watching an idle habitat at 21:59 would never see the dumpling settle down
 * — the screen only redraws when the pet changes, and during stasis it often does
 * not.
 *
 * Checked on the same half-minute cadence as the elapsed catch-up, plus on
 * foreground, since crossing the boundary with the phone locked is the common case.
 */
const CHECK_INTERVAL_MS = 30_000;

export function useQuietHours(schedule: SleepSchedule): boolean {
  const [isQuiet, setIsQuiet] = useState(() =>
    isAsleepAt(schedule, systemClock.now(), systemLocalTime),
  );

  useEffect(() => {
    const check = () => {
      setIsQuiet(isAsleepAt(schedule, systemClock.now(), systemLocalTime));
    };

    check();

    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        check();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [schedule]);

  return isQuiet;
}
