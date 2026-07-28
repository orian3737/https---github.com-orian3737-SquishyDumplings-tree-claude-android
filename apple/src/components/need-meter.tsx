import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

type NeedMeterProps = {
  icon: string;
  label: string;
  value: number;
  tint: string;
};

export function NeedMeter({ icon, label, value, tint }: NeedMeterProps) {
  return (
    <View
      accessibilityLabel={`${label}: ${value} out of 100`}
      style={{ gap: 7 }}
    >
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <Text
          selectable
          style={{ color: colors.ink, fontSize: 15, fontWeight: '700' }}
        >
          {icon} {label}
        </Text>
        <Text
          selectable
          style={{
            color: colors.muted,
            fontSize: 14,
            fontVariant: ['tabular-nums'],
            fontWeight: '700',
          }}
        >
          {value}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: '#eadfd7',
          borderCurve: 'continuous',
          borderRadius: 999,
          height: 9,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            backgroundColor: tint,
            borderCurve: 'continuous',
            borderRadius: 999,
            height: '100%',
            width: `${value}%`,
          }}
        />
      </View>
    </View>
  );
}
