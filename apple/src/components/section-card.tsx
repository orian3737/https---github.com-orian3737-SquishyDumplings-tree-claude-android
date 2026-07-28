import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

type SectionCardProps = PropsWithChildren<{
  title?: string;
  eyebrow?: string;
}>;

export function SectionCard({ children, eyebrow, title }: SectionCardProps) {
  return (
    <View
      style={{
        backgroundColor: colors.paper,
        borderColor: '#ead9cc',
        borderCurve: 'continuous',
        borderRadius: 24,
        borderWidth: 1,
        boxShadow: '0 8px 24px rgba(109, 76, 65, 0.09)',
        gap: 14,
        padding: 18,
      }}
    >
      {eyebrow ? (
        <Text
          selectable
          style={{
            color: colors.amberDeep,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 1.1,
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      {title ? (
        <Text
          selectable
          style={{ color: colors.ink, fontSize: 21, fontWeight: '800' }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
