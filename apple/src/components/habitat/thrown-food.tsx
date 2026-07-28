import { useEffect, useState } from 'react';
import { Animated, Easing, Text } from 'react-native';

import type { FoodItem } from '@/domain';
import type { ThrownFood } from '@/features/habitat/use-habitat-loop';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/**
 * A thrown food item, arcing from the wheel to where it lands.
 *
 * Prototype art: the emoji stands in for the four food sprites the asset manifest
 * still lists as blocking. The arc, the landing, and the settle are what matter for
 * validating the interaction; the picture is replaceable.
 */
const FOOD_GLYPHS: Readonly<Record<FoodItem, string>> = {
  'pork-chop': '🍖',
  'mixed-vegetable': '🥗',
  tofu: '🍥',
  scallion: '🌿',
};

export function ThrownFoodItem({
  food,
  habitatHeight,
  habitatWidth,
}: {
  food: ThrownFood;
  habitatHeight: number;
  habitatWidth: number;
}) {
  const reducedMotion = useReducedMotion();
  const [flight] = useState(() => new Animated.Value(0));

  // Everything is thrown from the wheel, so the launch point is the bottom centre
  // and the sideways travel is however far the landing spot is from there.
  const launchOffsetX = (0.5 - food.x) * habitatWidth;

  useEffect(() => {
    if (food.phase !== 'flying') {
      flight.setValue(1);
      return;
    }

    if (reducedMotion) {
      // No arc under Reduce Motion: the item simply appears where it landed.
      flight.setValue(1);
      return;
    }

    const animation = Animated.timing(flight, {
      duration: 780,
      easing: Easing.out(Easing.quad),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [flight, food.phase, reducedMotion]);

  return (
    <Animated.View
      style={{
        left: `${food.x * 100}%`,
        position: 'absolute',
        top: `${food.y * 100}%`,
        transform: [
          { translateX: -16 },
          {
            // Launches from the wheel at the bottom centre and travels sideways to
            // where it lands, so the throw reads as a throw rather than a drop.
            translateX: flight.interpolate({
              inputRange: [0, 1],
              outputRange: [launchOffsetX, 0],
            }),
          },
          {
            // A tall parabola: up past the landing point, then down onto it.
            translateY: flight.interpolate({
              inputRange: [0, 0.42, 1],
              outputRange: [habitatHeight * 0.72, -habitatHeight * 0.2, 0],
            }),
          },
          {
            scale: flight.interpolate({
              inputRange: [0, 0.45, 1],
              outputRange: [0.5, 1.25, 1],
            }),
          },
          {
            rotate: flight.interpolate({
              inputRange: [0, 1],
              outputRange: ['-140deg', '0deg'],
            }),
          },
        ],
      }}
    >
      <Text
        accessibilityLabel={`${food.item.replace('-', ' ')} on the floor`}
        style={{ fontSize: 30 }}
      >
        {FOOD_GLYPHS[food.item]}
      </Text>
    </Animated.View>
  );
}
