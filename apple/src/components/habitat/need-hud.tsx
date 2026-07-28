import { Text, View } from 'react-native';

import type { Needs } from '@/domain';
import { sceneColors } from '@/theme/scene-colors';

/**
 * The overlaid need indicators.
 *
 * FR-4: hunger, energy, and happiness sit on the environment as a compact cluster
 * rather than in cards below it. Cleanliness is deliberately absent — it is read
 * from the poop piles in the habitat, so putting it here would reintroduce the
 * meter the design removed.
 *
 * Each pill carries its own accessible label with the value spoken, so the state
 * never depends on reading a bar's fill.
 */
type NeedPill = Readonly<{
  icon: string;
  label: string;
  value: number;
  tint: string;
}>;

export function NeedHud({ needs }: { needs: Needs }) {
  const pills: readonly NeedPill[] = [
    { icon: '🥣', label: 'Hunger', value: needs.hunger, tint: '#e8b45f' },
    { icon: '🌙', label: 'Energy', value: needs.energy, tint: '#8fb4cf' },
    { icon: '💗', label: 'Happiness', value: needs.happiness, tint: '#e0919f' },
  ];

  return (
    <View style={{ gap: 7 }}>
      {pills.map((pill) => (
        <View
          accessibilityLabel={`${pill.label} ${pill.value} out of 100`}
          accessibilityRole="progressbar"
          key={pill.label}
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(255, 253, 247, 0.88)',
            borderColor: sceneColors.trim,
            borderCurve: 'continuous',
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 7,
            paddingHorizontal: 9,
            paddingVertical: 5,
          }}
        >
          <Text style={{ fontSize: 14 }}>{pill.icon}</Text>

          {/* The bar is decoration; the value beside it is the real signal, so
              nothing here relies on colour alone. */}
          <View
            style={{
              backgroundColor: 'rgba(156, 134, 116, 0.18)',
              borderRadius: 999,
              height: 6,
              overflow: 'hidden',
              width: 54,
            }}
          >
            <View
              style={{
                backgroundColor: pill.tint,
                borderRadius: 999,
                height: '100%',
                width: `${Math.max(2, pill.value)}%`,
              }}
            />
          </View>

          <Text
            style={{
              color: sceneColors.outline,
              fontSize: 12,
              fontVariant: ['tabular-nums'],
              fontWeight: '900',
              minWidth: 22,
              textAlign: 'right',
            }}
          >
            {pill.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
