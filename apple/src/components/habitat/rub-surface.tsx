import { useMemo, type ReactNode } from 'react';
import { PanResponder, View, type ViewStyle } from 'react-native';

/**
 * A surface you rub.
 *
 * One gesture primitive, two uses: rubbing the dumpling pets it, and rubbing a mess
 * scrubs it away. Both want the same feel, so both share this rather than growing
 * two slightly different implementations that drift apart.
 *
 * It reports the gesture's running displacement rather than measuring path length
 * itself. Measuring here would need mutable state written during render, and the
 * running totals are all the caller needs to derive distance travelled.
 *
 * A plain tap is the accessible equivalent. FR-5 requires a non-gesture path to
 * every care action, and a tap is also what VoiceOver and Switch Control activate —
 * neither can perform a rub.
 */
export function RubSurface({
  accessibilityHint,
  accessibilityLabel,
  children,
  disabled = false,
  onActivate,
  onRubMove,
  onRubStart,
  style,
}: {
  accessibilityHint: string;
  accessibilityLabel: string;
  children: ReactNode;
  disabled?: boolean;
  /** The non-gesture path: one deliberate round of whatever this surface does. */
  onActivate: () => void;
  onRubMove: (dx: number, dy: number) => void;
  onRubStart: () => void;
  style?: ViewStyle;
}) {
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !disabled && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),

        onPanResponderGrant: () => {
          onRubStart();
        },

        onPanResponderMove: (_event, gesture) => {
          onRubMove(gesture.dx, gesture.dy);
        },

        onPanResponderRelease: (_event, gesture) => {
          if (Math.hypot(gesture.dx, gesture.dy) < 6) {
            // Barely moved: treat it as the tap path rather than a failed rub.
            onActivate();
          }
        },
      }),
    [disabled, onActivate, onRubMove, onRubStart],
  );

  return (
    <View
      {...responder.panHandlers}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onAccessibilityTap={onActivate}
      style={style}
    >
      {children}
    </View>
  );
}
