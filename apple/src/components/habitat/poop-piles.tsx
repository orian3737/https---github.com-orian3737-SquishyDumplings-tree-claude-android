import { Animated } from 'react-native';

import type { PoopPile } from '@/features/habitat/use-habitat-loop';

import { RubSurface } from './rub-surface';

/**
 * The poop piles, which are the only cleanliness display in the app.
 *
 * Each pile is dropped by the dumpling at a real position rather than slotted into a
 * fixed spot, so the floor fills in the way the pet actually moved around it.
 *
 * Cleaning is the same rub gesture as petting — scrub a mess and it lifts, paying out
 * in bubbles as it goes. A tap clears one outright, which is the accessible path and
 * what VoiceOver activates. There is no highlight ring in cleanup mode: a ring around
 * every pile read as clutter, and the feedback belongs on the gesture instead.
 */
export function PoopPiles({
  onScrubMove,
  onScrubStart,
  onTap,
  piles,
}: {
  onScrubMove: (pileId: string, dx: number, dy: number) => void;
  onScrubStart: (pileId: string) => void;
  onTap: (pileId: string) => void;
  piles: readonly PoopPile[];
}) {
  return (
    <>
      {piles.map((pile, index) => (
        <RubSurface
          accessibilityHint="Scrub across this mess to clean it, or activate this to clear it"
          accessibilityLabel={`Mess ${index + 1} of ${piles.length}`}
          key={pile.id}
          onActivate={() => onTap(pile.id)}
          onRubMove={(dx, dy) => onScrubMove(pile.id, dx, dy)}
          onRubStart={() => onScrubStart(pile.id)}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            left: `${pile.x * 100}%`,
            // A generous hit area around a small drawing, so scrubbing does not
            // require precision.
            minHeight: 54,
            minWidth: 54,
            position: 'absolute',
            top: `${pile.y * 100}%`,
            transform: [{ translateX: -27 }, { translateY: -27 }],
          }}
        >
          <Animated.Text style={{ fontSize: 25 * pile.scale }}>
            💩
          </Animated.Text>
        </RubSurface>
      ))}
    </>
  );
}
