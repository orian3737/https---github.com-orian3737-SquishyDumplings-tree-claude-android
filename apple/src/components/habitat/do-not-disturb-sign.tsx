import { Text, View } from 'react-native';

import { sceneColors } from '@/theme/scene-colors';

/**
 * A little sign planted on the floor in front of a sleeping dumpling.
 *
 * This replaced a pill badge floating over the pet's head. The badge said the right
 * words but read as UI stuck on top of the room, and the habitat's whole premise is
 * that the environment is the screen (FR-4) — so the notice is an object in the room
 * instead, sharing the scene's wood and cream and planted at the dumpling's feet.
 *
 * Two short lines rather than one long one keeps the placard narrow enough to sit in
 * front of the dumpling without hiding it.
 */

/** Placard width in points at `scale` 1. The caller scales it for floor depth. */
export const SIGN_WIDTH = 96;
/** Placard, post, and base together, so a caller can plant the base on the floor. */
export const SIGN_HEIGHT = 62;

const PLACARD_HEIGHT = 42;
const POST_HEIGHT = 14;

const SIGN_TEXT = '#7a5334';

export function DoNotDisturbSign({
  name,
  scale = 1,
}: {
  /** The dumpling's name, for the screen-reader label. */
  name: string;
  scale?: number;
}) {
  return (
    <View
      accessibilityLabel={`${name} is sleeping. Do not disturb.`}
      accessibilityRole="text"
      pointerEvents="none"
      style={{
        alignItems: 'center',
        height: SIGN_HEIGHT,
        justifyContent: 'flex-start',
        transform: [{ scale }],
        // Scaling from the base keeps the post's feet on the floor as depth changes.
        transformOrigin: 'bottom',
        width: SIGN_WIDTH,
      }}
    >
      {/* A few degrees off true, so it reads as something set down by hand. */}
      <View style={{ alignItems: 'center', transform: [{ rotate: '-4deg' }] }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: sceneColors.cloud,
            borderColor: sceneColors.outline,
            borderCurve: 'continuous',
            borderRadius: 12,
            borderWidth: 1.5,
            height: PLACARD_HEIGHT,
            justifyContent: 'center',
            paddingHorizontal: 8,
            width: SIGN_WIDTH,
          }}
        >
          <Text
            style={{
              color: SIGN_TEXT,
              fontSize: 9,
              fontWeight: '800',
              letterSpacing: 1.1,
            }}
          >
            DO NOT
          </Text>
          <Text
            style={{
              color: SIGN_TEXT,
              fontSize: 12,
              fontWeight: '900',
              letterSpacing: 0.6,
            }}
          >
            DISTURB
          </Text>
        </View>

        {/* The stake, and two little feet so it stands rather than floats. */}
        <View
          style={{
            backgroundColor: sceneColors.bamboo,
            borderColor: sceneColors.bambooShade,
            borderWidth: 1,
            height: POST_HEIGHT,
            width: 8,
          }}
        />
        <View
          style={{
            backgroundColor: sceneColors.bambooShade,
            borderRadius: 2,
            height: 3,
            width: 22,
          }}
        />
      </View>
    </View>
  );
}
