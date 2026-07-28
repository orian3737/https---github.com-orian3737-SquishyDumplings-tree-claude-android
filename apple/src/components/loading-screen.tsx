import { ActivityIndicator, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

/**
 * The branded cold-launch state (FR-1). Deliberately calm and static: it is on
 * screen for a fraction of a second on a warm launch, so anything animated here
 * would read as a flash rather than as polish.
 */
export function LoadingScreen({
  message = 'Warming the steamer…',
}: {
  message?: string;
}) {
  return (
    <View
      accessibilityLabel={message}
      accessibilityRole="progressbar"
      style={{
        alignItems: 'center',
        backgroundColor: colors.cream,
        flex: 1,
        gap: 18,
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Text style={{ fontSize: 56 }}>🥟</Text>
      <ActivityIndicator color={colors.amberDeep} />
      <Text
        style={{
          color: colors.brownSoft,
          fontSize: 15,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  );
}
