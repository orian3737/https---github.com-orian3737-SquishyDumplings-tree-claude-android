import { Pressable, Text, View } from 'react-native';

import {
  formatMinuteOfDay,
  MINUTES_PER_DAY,
  sleepWindowMinutes,
  type SleepSchedule,
} from '@/domain';
import { colors } from '@/theme/colors';

/**
 * When the dumpling settles down for the night.
 *
 * A pair of steppers rather than a native time picker: the whole control is two
 * values at half-hour resolution, and a wheel picker would pull in a dependency and
 * a modal presentation to express the same thing less accessibly. Every button is a
 * plain 44-point target that VoiceOver reaches without a gesture.
 */
const STEP_MINUTES = 30;

function stepMinute(minute: number, direction: 1 | -1): number {
  const stepped = minute + direction * STEP_MINUTES;
  return ((stepped % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function describeHours(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hours`;
  }

  return `${hours}h ${minutes}m`;
}

function StepperRow({
  label,
  minuteOfDay,
  onChange,
}: {
  label: string;
  minuteOfDay: number;
  onChange: (next: number) => void;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>
        {label}
      </Text>

      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
        <StepButton
          accessibilityLabel={`${label} half an hour earlier`}
          glyph="−"
          onPress={() => onChange(stepMinute(minuteOfDay, -1))}
        />

        <Text
          accessibilityLabel={`${label} ${formatMinuteOfDay(minuteOfDay)}`}
          style={{
            color: colors.ink,
            fontSize: 17,
            fontVariant: ['tabular-nums'],
            fontWeight: '900',
            minWidth: 68,
            textAlign: 'center',
          }}
        >
          {formatMinuteOfDay(minuteOfDay)}
        </Text>

        <StepButton
          accessibilityLabel={`${label} half an hour later`}
          glyph="+"
          onPress={() => onChange(stepMinute(minuteOfDay, 1))}
        />
      </View>
    </View>
  );
}

function StepButton({
  accessibilityLabel,
  glyph,
  onPress,
}: {
  accessibilityLabel: string;
  glyph: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? '#e6d3c2' : '#f3e6da',
        borderRadius: 12,
        height: 44,
        justifyContent: 'center',
        width: 44,
      })}
    >
      <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>
        {glyph}
      </Text>
    </Pressable>
  );
}

export function BedtimeSetting({
  schedule,
  onChange,
}: {
  schedule: SleepSchedule;
  onChange: (next: SleepSchedule) => void;
}) {
  const windowMinutes = sleepWindowMinutes(schedule);

  return (
    <View style={{ gap: 14 }}>
      <Text style={{ color: colors.muted, lineHeight: 21 }}>
        Your dumpling sleeps through these hours. It will not get hungry or
        unhappy while it is asleep, and it wakes up rested.
      </Text>

      <StepperRow
        label="Bedtime"
        minuteOfDay={schedule.startMinuteOfDay}
        onChange={(startMinuteOfDay) =>
          onChange({ ...schedule, startMinuteOfDay })
        }
      />

      <StepperRow
        label="Wake up"
        minuteOfDay={schedule.endMinuteOfDay}
        onChange={(endMinuteOfDay) => onChange({ ...schedule, endMinuteOfDay })}
      />

      <Text style={{ color: colors.muted, fontSize: 13 }}>
        {windowMinutes === 0
          ? 'Bedtime and wake-up match, so your dumpling never sleeps.'
          : `Asleep for ${describeHours(windowMinutes)} a night.`}
      </Text>
    </View>
  );
}
