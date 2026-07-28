import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { sceneColors } from '@/theme/scene-colors';

import { GlassSurface } from './glass-surface';

/**
 * The habitat's action wheel.
 *
 * Replaces the tab bar so the environment keeps the whole screen. Every segment
 * acts over the habitat and none navigates away, which is what gives the control a
 * single mental model — settings deliberately lives elsewhere.
 *
 * Drag horizontally to spin. The segment in the centre is the selection, and
 * releasing snaps to whichever landed there. Flicking the centre upward acts on it.
 *
 * The layout is cyclic: each segment is placed by its distance from the selection,
 * wrapped so there is always one on each side. Laying them out by absolute index
 * instead pushes the whole set to one side and walks the last one off screen.
 *
 * Accessibility is not the gesture. Every segment is also a plain focusable button
 * with a 44-point target that selects on tap, so VoiceOver never has to perform a
 * radial drag (BUILD_SPEC section 8 makes that an acceptance criterion).
 */
export type WheelAction = 'feed' | 'clean' | 'wardrobe';

/**
 * The flick that acted on the centre segment.
 *
 * Passed through rather than reduced to a boolean because feeding aims with it —
 * how far and which way the player flicked is where the food should land. Null
 * when the action came from a tap, which has no direction to read.
 */
export type WheelFlick = Readonly<{
  dx: number;
  dy: number;
  vx: number;
  vy: number;
}>;

type Segment = Readonly<{
  action: WheelAction;
  icon: string;
  label: string;
  hint: string;
}>;

const SEGMENTS: readonly Segment[] = [
  {
    action: 'feed',
    icon: '🥟',
    label: 'Feed',
    hint: 'Selected: flick upward to throw food into the habitat',
  },
  {
    action: 'clean',
    icon: '🧼',
    label: 'Clean',
    hint: 'Selected: tap each mess in the habitat to clear it',
  },
  {
    action: 'wardrobe',
    icon: '👕',
    label: 'Wrappers',
    hint: 'Selected: opens the wardrobe over the habitat',
  },
];

/**
 * How tall the wheel is, in points.
 *
 * Exported because the habitat has to keep food and messes above it, and a second
 * copy of this number in the screen would silently stop matching the day the wheel
 * changes height.
 */
export const ACTION_WHEEL_HEIGHT = 104;

/** Horizontal spacing between neighbouring segments, in points. */
const SLOT_WIDTH = 92;

/**
 * The wheel's radius.
 *
 * Both the icons and the glass track behind them are derived from this one circle,
 * so the bar is genuinely curved to where the icons sit rather than being a flat
 * pill with an arc floating over it.
 */
const WHEEL_RADIUS = 340;

/** How far the rim drops at a horizontal distance from the centre. */
function arcDrop(distance: number): number {
  const clamped = Math.min(Math.abs(distance), WHEEL_RADIUS);
  return (
    WHEEL_RADIUS - Math.sqrt(WHEEL_RADIUS * WHEEL_RADIUS - clamped * clamped)
  );
}

const DROP_ONE = arcDrop(SLOT_WIDTH);
const DROP_TWO = arcDrop(SLOT_WIDTH * 2);
const SNAP_MS = 240;
const DRAG_SCALE = 1;
/** Upward velocity that counts as a deliberate flick rather than a scroll. */
const FLICK_VELOCITY = 0.5;
const FLICK_DISTANCE = 26;

/** Signed distance from the selection, wrapped so neighbours sit on both sides. */
function slotFor(index: number, selectedIndex: number, count: number): number {
  const raw = index - selectedIndex;
  const half = Math.floor(count / 2);

  if (raw > half) {
    return raw - count;
  }
  if (raw < -half) {
    return raw + count;
  }
  return raw;
}

export function ActionWheel({
  selected,
  onSelect,
  onFlick,
}: {
  selected: WheelAction;
  onSelect: (action: WheelAction) => void;
  /**
   * Fired when the player flicks the centre segment upward or taps it. The flick
   * is null for a tap, which is the accessible path and carries no aim.
   */
  onFlick: (action: WheelAction, flick: WheelFlick | null) => void;
}) {
  const reducedMotion = useReducedMotion();
  const selectedIndex = Math.max(
    0,
    SEGMENTS.findIndex((segment) => segment.action === selected),
  );

  /**
   * Live drag offset in points. Zero at rest: segment positions come from their
   * slot, and this only carries the in-progress drag plus its settle.
   */
  const [drag] = useState(() => new Animated.Value(0));
  const [lift] = useState(() => new Animated.Value(0));

  // Settle back to centre whenever the selection changes.
  useEffect(() => {
    if (reducedMotion) {
      drag.setValue(0);
      return;
    }

    const animation = Animated.timing(drag, {
      duration: SNAP_MS,
      easing: Easing.out(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [drag, reducedMotion, selectedIndex]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,

        onPanResponderMove: (_event, gesture) => {
          drag.setValue(gesture.dx * DRAG_SCALE);

          if (gesture.dy < 0) {
            // A small nudge only: a big travel made the whole menu wobble.
            lift.setValue(Math.min(-gesture.dy * 0.28, 12));
          }
        },

        onPanResponderRelease: (_event, gesture) => {
          lift.setValue(0);

          const flicked =
            gesture.vy < -FLICK_VELOCITY && gesture.dy < -FLICK_DISTANCE;

          if (flicked && Math.abs(gesture.dx) < Math.abs(gesture.dy)) {
            // A deliberate upward flick acts on the centre rather than re-aiming.
            // Its vector goes with it: feeding throws where the player aimed.
            drag.setValue(0);
            onFlick(selected, {
              dx: gesture.dx,
              dy: gesture.dy,
              vx: gesture.vx,
              vy: gesture.vy,
            });
            return;
          }

          // Dragging right brings the segment on the left into the centre, so the
          // selection moves the opposite way to the finger.
          const steps = Math.round(-gesture.dx / SLOT_WIDTH);
          if (steps === 0) {
            drag.setValue(0);
            return;
          }

          const count = SEGMENTS.length;
          const nextIndex = (((selectedIndex + steps) % count) + count) % count;
          const next = SEGMENTS[nextIndex];

          if (next === undefined || next.action === selected) {
            drag.setValue(0);
            return;
          }

          // Hand the residual to the settle animation so the motion stays
          // continuous across the selection change instead of jumping.
          drag.setValue(gesture.dx + steps * SLOT_WIDTH);
          onSelect(next.action);
        },

        onPanResponderTerminate: () => {
          lift.setValue(0);
          drag.setValue(0);
        },
      }),
    [drag, lift, onFlick, onSelect, selected, selectedIndex],
  );

  return (
    <View
      style={{
        alignItems: 'center',
        height: ACTION_WHEEL_HEIGHT,
        width: '100%',
      }}
    >
      {/*
        The track: a very large circle with most of its body pushed below the
        screen, so the part that shows is the same rim the icons ride on. A pill
        cannot do this — its top edge is straight while the icons curve away from it.
      */}
      <View
        pointerEvents="none"
        style={{
          bottom: 0,
          height: 96,
          left: 0,
          overflow: 'hidden',
          position: 'absolute',
          right: 0,
        }}
      >
        <GlassSurface
          borderRadius={WHEEL_RADIUS}
          intensity={22}
          style={{
            height: WHEEL_RADIUS * 2,
            left: '50%',
            marginLeft: -WHEEL_RADIUS,
            position: 'absolute',
            top: 18,
            width: WHEEL_RADIUS * 2,
          }}
        />
      </View>

      <Animated.View
        {...responder.panHandlers}
        style={{
          height: ACTION_WHEEL_HEIGHT,
          justifyContent: 'flex-end',
          transform: [{ translateY: Animated.multiply(lift, -1) }],
          width: '100%',
        }}
      >
        {SEGMENTS.map((segment, index) => {
          const isSelected = segment.action === selected;
          const slot = slotFor(index, selectedIndex, SEGMENTS.length);

          // Where this segment sits: its slot, shifted by the live drag.
          const x = Animated.add(slot * SLOT_WIDTH, drag);
          const distance = x.interpolate({
            inputRange: [-SLOT_WIDTH * 2, 0, SLOT_WIDTH * 2],
            outputRange: [2, 0, 2],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={segment.action}
              style={{
                bottom: 8,
                left: '50%',
                opacity: distance.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [1, 0.62, 0.28],
                }),
                position: 'absolute',
                transform: [
                  { translateX: -38 },
                  { translateX: x },
                  {
                    translateY: distance.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [0, DROP_ONE, DROP_TWO],
                    }),
                  },
                  {
                    scale: distance.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [1, 0.8, 0.66],
                    }),
                  },
                ],
              }}
            >
              <Pressable
                accessibilityHint={segment.hint}
                accessibilityLabel={segment.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                onPress={() =>
                  isSelected
                    ? // A tap has no direction to aim with, which the null says.
                      onFlick(segment.action, null)
                    : onSelect(segment.action)
                }
              >
                <GlassSurface
                  borderRadius={22}
                  highlighted={isSelected}
                  intensity={isSelected ? 46 : 20}
                  style={{
                    alignItems: 'center',
                    height: 64,
                    justifyContent: 'center',
                    width: 76,
                  }}
                >
                  <Text style={{ fontSize: 25 }}>{segment.icon}</Text>
                  <Text
                    style={{
                      color: sceneColors.outline,
                      fontSize: 10,
                      fontWeight: '900',
                    }}
                  >
                    {segment.label}
                  </Text>
                </GlassSurface>
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}
