import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.cream,
          flex: 1,
          gap: 16,
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text
          selectable
          style={{ color: colors.ink, fontSize: 22, fontWeight: '800' }}
        >
          Bao waddled somewhere else.
        </Text>
        <Link href="/" style={{ color: colors.amberDeep, fontWeight: '800' }}>
          Return to the habitat
        </Link>
      </View>
    </>
  );
}
