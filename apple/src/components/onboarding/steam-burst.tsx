import { Animated, View } from 'react-native';

type SteamBlob = Readonly<{
  color: string;
  delay: number;
  left: `${number}%`;
  size: number;
  top: `${number}%`;
  rise: number;
}>;

const BLOBS: readonly SteamBlob[] = [
  {
    color: '#f8f8f5',
    delay: 0,
    left: '38%',
    rise: -120,
    size: 170,
    top: '48%',
  },
  {
    color: '#dedfdf',
    delay: 0.04,
    left: '-8%',
    rise: -72,
    size: 150,
    top: '58%',
  },
  {
    color: '#eeeeeb',
    delay: 0.08,
    left: '67%',
    rise: -96,
    size: 166,
    top: '54%',
  },
  {
    color: '#cfd1d1',
    delay: 0.12,
    left: '13%',
    rise: -138,
    size: 126,
    top: '72%',
  },
  {
    color: '#f5f5f2',
    delay: 0.16,
    left: '57%',
    rise: -148,
    size: 134,
    top: '69%',
  },
  {
    color: '#d7d9d9',
    delay: 0.2,
    left: '76%',
    rise: -112,
    size: 116,
    top: '79%',
  },
  {
    color: '#ececea',
    delay: 0.24,
    left: '-4%',
    rise: -128,
    size: 122,
    top: '84%',
  },
  {
    color: '#c8cbcb',
    delay: 0.28,
    left: '30%',
    rise: -164,
    size: 112,
    top: '88%',
  },
  {
    color: '#f7f7f4',
    delay: 0.32,
    left: '62%',
    rise: -176,
    size: 116,
    top: '91%',
  },
  {
    color: '#dfe1e1',
    delay: 0.36,
    left: '7%',
    rise: -190,
    size: 104,
    top: '96%',
  },
];

/**
 * Full-screen layered steam. Every blob follows the same compositor-driven
 * progress value with a small phase offset, creating a rising burst with depth
 * instead of one flat cloud over the steamer.
 */
export function SteamBurst({ progress }: { progress: Animated.Value }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={{ inset: 0, overflow: 'hidden', position: 'absolute' }}
    >
      {/* A soft fog plate guarantees full coverage at the reveal's peak. The
          individual blobs below still provide depth and visible movement, but no
          cream-colored gaps can show through the middle of the cloud. */}
      <Animated.View
        style={{
          backgroundColor: '#e7e9e8',
          inset: 0,
          opacity: progress.interpolate({
            inputRange: [0, 0.18, 0.42, 0.7, 0.86, 1],
            outputRange: [0, 0.38, 0.98, 1, 0.64, 0],
            extrapolate: 'clamp',
          }),
          position: 'absolute',
        }}
      />

      {BLOBS.map((blob, index) => {
        const appear = Math.min(0.72, blob.delay + 0.22);
        return (
          <Animated.View
            key={`${blob.left}-${blob.top}`}
            style={{
              backgroundColor: blob.color,
              borderRadius: 999,
              height: blob.size,
              left: blob.left,
              opacity: progress.interpolate({
                inputRange: [blob.delay, appear, 0.7, 0.86, 1],
                outputRange: [0, 0.94, 1, 0.7, 0],
                extrapolate: 'clamp',
              }),
              position: 'absolute',
              top: blob.top,
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [42 + index * 3, blob.rise],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.32, 1 + index * 0.018, 1.5],
                  }),
                },
              ],
              width: blob.size * 1.18,
            }}
          />
        );
      })}
    </View>
  );
}
