import { View } from 'react-native';

import { colors } from '@/theme/colors';

const SLATS = [12, 30, 48, 66, 84, 102, 120, 138, 156, 174] as const;
const WEAVE_ROWS = [5, 16, 27, 38] as const;

function BasketTier({ top }: { top: number }) {
  return (
    <View
      style={{
        backgroundColor: '#dca755',
        borderColor: colors.brown,
        borderCurve: 'continuous',
        borderRadius: 16,
        borderWidth: 4,
        height: 54,
        left: 10,
        overflow: 'hidden',
        position: 'absolute',
        top,
        width: 196,
      }}
    >
      {SLATS.map((left) => (
        <View
          key={left}
          style={{
            backgroundColor: '#b97832',
            bottom: 5,
            left,
            opacity: 0.5,
            position: 'absolute',
            top: 8,
            width: 3,
          }}
        />
      ))}

      <View
        style={{
          backgroundColor: '#f0ca78',
          borderBottomColor: '#a9672e',
          borderBottomWidth: 3,
          borderRadius: 999,
          height: 17,
          left: -4,
          position: 'absolute',
          right: -4,
          top: -4,
        }}
      />
      <View
        style={{
          backgroundColor: '#bd7a34',
          bottom: 3,
          height: 7,
          left: 0,
          opacity: 0.88,
          position: 'absolute',
          right: 0,
        }}
      />
    </View>
  );
}

/** The steamer's natural size. Every part inside is positioned against this box. */
export const STEAMER_WIDTH = 216;
export const STEAMER_HEIGHT = 178;

/**
 * Chibi Chinese bamboo steamer.
 *
 * Its stacked cylindrical baskets, bamboo-slat sides, woven domed lid, and loop
 * handle follow the real dim-sum tool. Rounded proportions and the tiny face keep
 * it in the same warm character language as the dumpling.
 *
 * Drawn rather than set as an emoji. The onboarding header used 🧺 for a while, which
 * is the *basket* emoji — on iOS it renders as a wicker laundry basket with towels in
 * it, so the first screen of the game showed the player the wrong object entirely.
 */
export function DumplingSteamer({
  /** Scales the whole steamer, shrinking its layout box to match. */
  scale = 1,
}: {
  scale?: number;
}) {
  return (
    <View
      accessibilityLabel="Stacked woven bamboo dumpling steamer"
      // The outer box carries the scaled footprint so surrounding layout reflows
      // correctly; the inner box keeps its natural size so every absolute offset below
      // stays valid. Scaling the outer box alone would leave a full-size hole in the
      // layout around a shrunken drawing.
      style={{ height: STEAMER_HEIGHT * scale, width: STEAMER_WIDTH * scale }}
    >
      <View
        style={{
          alignItems: 'center',
          height: STEAMER_HEIGHT,
          justifyContent: 'flex-end',
          transform: [{ scale }],
          transformOrigin: 'top left',
          width: STEAMER_WIDTH,
        }}
      >
        <BasketTier top={77} />
        <BasketTier top={119} />

        {/* Woven lid clipped into a broad, shallow oval. */}
        <View
          style={{
            backgroundColor: '#edc779',
            borderColor: colors.brown,
            borderRadius: 999,
            borderWidth: 4,
            height: 56,
            left: 13,
            overflow: 'hidden',
            position: 'absolute',
            top: 24,
            width: 190,
          }}
        >
          {WEAVE_ROWS.map((top) => (
            <View
              key={`forward-${top}`}
              style={{
                backgroundColor: '#b97832',
                height: 3,
                left: -20,
                opacity: 0.58,
                position: 'absolute',
                top,
                transform: [{ rotate: '14deg' }],
                width: 230,
              }}
            />
          ))}
          {WEAVE_ROWS.map((top) => (
            <View
              key={`back-${top}`}
              style={{
                backgroundColor: '#c98d43',
                height: 3,
                left: -20,
                opacity: 0.55,
                position: 'absolute',
                top,
                transform: [{ rotate: '-14deg' }],
                width: 230,
              }}
            />
          ))}
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.22)',
              borderRadius: 999,
              height: 30,
              left: 20,
              position: 'absolute',
              top: 4,
              transform: [{ rotate: '-10deg' }],
              width: 12,
            }}
          />
        </View>

        {/* Thick lid rim and traditional loop handle. */}
        <View
          style={{
            backgroundColor: '#d69d48',
            borderColor: colors.brown,
            borderRadius: 999,
            borderWidth: 4,
            height: 22,
            left: 7,
            position: 'absolute',
            top: 62,
            width: 202,
          }}
        />
        <View
          style={{
            borderColor: colors.brown,
            borderRadius: 28,
            borderWidth: 5,
            height: 27,
            left: 82,
            position: 'absolute',
            top: 5,
            width: 52,
          }}
        >
          <View
            style={{
              backgroundColor: '#e0ad59',
              borderRadius: 999,
              inset: 4,
              position: 'absolute',
            }}
          />
        </View>

        {/* A very small chibi face, secondary to the authentic basket structure. */}
        <View
          style={{
            bottom: 17,
            flexDirection: 'row',
            gap: 24,
            left: 80,
            position: 'absolute',
          }}
        >
          <View
            style={{
              backgroundColor: colors.brown,
              borderRadius: 999,
              height: 6,
              width: 6,
            }}
          />
          <View
            style={{
              backgroundColor: colors.brown,
              borderRadius: 999,
              height: 6,
              width: 6,
            }}
          />
        </View>
        <View
          style={{
            borderBottomColor: colors.brown,
            borderBottomWidth: 3,
            borderRadius: 999,
            bottom: 10,
            height: 11,
            left: 99,
            position: 'absolute',
            width: 18,
          }}
        />
      </View>
    </View>
  );
}
