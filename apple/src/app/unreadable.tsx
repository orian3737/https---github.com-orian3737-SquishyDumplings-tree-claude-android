import { Pressable, ScrollView, Text, View } from 'react-native';

import { useSession } from '@/features/session/session-provider';
import { colors } from '@/theme/colors';

/**
 * Saved state exists but could not be read.
 *
 * This screen deliberately offers no way to start over. Hatching from here would
 * replace the dumpling the player already has, and the one-dumpling promise is
 * about their pet surviving, not just about the code being internally consistent.
 * Retrying is the only action; once PR 7 adds sync, this becomes recoverable from
 * the server instead of terminal.
 */
export default function UnreadableScreen() {
  const { state, reload } = useSession();
  const detail = state.status === 'unreadable' ? state.error : null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.cream }}
      contentContainerStyle={{ gap: 18, padding: 22 }}
    >
      <Text style={{ fontSize: 52 }}>🫙</Text>

      <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '900' }}>
        We couldn&apos;t open your dumpling&apos;s jar
      </Text>

      <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>
        Your saved dumpling is still on this device, but this build could not
        read it. We have not changed or replaced anything.
      </Text>

      <Pressable
        accessibilityHint="Tries to read your saved dumpling again"
        accessibilityLabel="Try again"
        accessibilityRole="button"
        onPress={() => {
          void reload();
        }}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: pressed ? colors.amberDeep : colors.amber,
          borderCurve: 'continuous',
          borderRadius: 18,
          minHeight: 52,
          justifyContent: 'center',
          paddingHorizontal: 20,
        })}
      >
        <Text style={{ color: colors.brown, fontSize: 17, fontWeight: '900' }}>
          Try again
        </Text>
      </Pressable>

      {detail === null ? null : (
        <View
          style={{
            backgroundColor: colors.paper,
            borderColor: '#ead9cc',
            borderCurve: 'continuous',
            borderRadius: 16,
            borderWidth: 1,
            gap: 6,
            padding: 14,
          }}
        >
          <Text
            style={{ color: colors.brownSoft, fontSize: 12, fontWeight: '800' }}
          >
            DETAILS
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 13 }}>
            {detail}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
