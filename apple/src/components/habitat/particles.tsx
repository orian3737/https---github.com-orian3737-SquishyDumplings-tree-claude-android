import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

import type { Particle } from '@/features/habitat/use-habitat-loop';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/**
 * Floating feedback for the habitat: hearts while petting, bubbles while scrubbing,
 * a cross when a rub did not land, and `zzz` off a sleeping dumpling.
 *
 * One system rather than several, because they all want the same drift-and-fade.
 * Purely decorative: the need indicators, the disappearing mess, and the sleep sign
 * carry the real information, which is what keeps this safe to drop under Reduce
 * Motion.
 */
const GLYPHS: Readonly<Record<Particle['kind'], string>> = {
  bubble: '🫧',
  cross: '✖️',
  heart: '💗',
  sleepy: '💤',
};

export function Particles({
  particles,
  onExpire,
}: {
  particles: readonly Particle[];
  onExpire: (id: string) => void;
}) {
  return (
    <>
      {particles.map((particle) => (
        <FloatingParticle
          key={particle.id}
          onExpire={onExpire}
          particle={particle}
        />
      ))}
    </>
  );
}

function FloatingParticle({
  onExpire,
  particle,
}: {
  onExpire: (id: string) => void;
  particle: Particle;
}) {
  const reducedMotion = useReducedMotion();
  const [rise] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) {
      // Nothing to float. Clear it promptly so particles cannot pile up on screen.
      const timer = setTimeout(() => onExpire(particle.id), 380);
      return () => clearTimeout(timer);
    }

    const animation = Animated.timing(rise, {
      duration: 1000,
      easing: Easing.out(Easing.quad),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        onExpire(particle.id);
      }
    });

    return () => animation.stop();
  }, [onExpire, particle.id, reducedMotion, rise]);

  return (
    <Animated.Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      pointerEvents="none"
      style={{
        fontSize: 22 * particle.scale,
        left: `${particle.x * 100}%`,
        opacity: rise.interpolate({
          inputRange: [0, 0.2, 0.72, 1],
          outputRange: [0, 1, 0.9, 0],
        }),
        position: 'absolute',
        top: `${particle.y * 100}%`,
        transform: [
          { translateX: -11 },
          {
            translateY: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -88],
            }),
          },
          {
            // Drifts sideways as it rises, so a burst does not read as one column.
            translateX: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [0, particle.drift],
            }),
          },
          {
            scale: rise.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [0.5, 1, 0.8],
            }),
          },
        ],
      }}
    >
      {GLYPHS[particle.kind]}
    </Animated.Text>
  );
}
