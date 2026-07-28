import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { sceneColors } from '@/theme/scene-colors';

/**
 * A liquid-glass panel.
 *
 * Three layers make glass read as glass rather than as a translucent rectangle: a
 * real blur of what is behind it, a soft tint so it picks up the room's warmth, and
 * a bright top edge that behaves like a specular highlight. Without the highlight
 * it looks like frosted plastic.
 *
 * `expo-blur` ships inside Expo Go, so this needs no development build.
 */
export function GlassSurface({
  borderRadius = 28,
  children,
  intensity = 34,
  style,
  highlighted = false,
}: {
  borderRadius?: number;
  children?: ReactNode;
  intensity?: number;
  style?: ViewStyle;
  /** Selected state: brighter tint and a stronger rim. */
  highlighted?: boolean;
}) {
  return (
    <View
      style={[
        {
          borderCurve: 'continuous',
          borderRadius,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint="light"
        style={{ inset: 0, position: 'absolute' }}
      />

      {/* Warm tint, so the glass belongs to this room rather than to iOS. */}
      <View
        style={{
          backgroundColor: highlighted
            ? 'rgba(255, 253, 247, 0.52)'
            : 'rgba(255, 253, 247, 0.3)',
          inset: 0,
          position: 'absolute',
        }}
      />

      {/* Specular highlight along the top edge. */}
      <View
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.55)',
          height: 1,
          left: borderRadius * 0.4,
          position: 'absolute',
          right: borderRadius * 0.4,
          top: 0,
        }}
      />

      {/* Rim. */}
      <View
        pointerEvents="none"
        style={{
          borderColor: highlighted
            ? 'rgba(156, 134, 116, 0.5)'
            : 'rgba(224, 211, 186, 0.7)',
          borderCurve: 'continuous',
          borderRadius,
          borderWidth: highlighted ? 1.6 : 1,
          inset: 0,
          position: 'absolute',
        }}
      />

      {children}
    </View>
  );
}

export const glassTextColor = sceneColors.outline;
