import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

import type { PetAnimationState } from '@/domain';

import { useReducedMotion } from '@/hooks/use-reduced-motion';

/**
 * Procedural motion for the dumpling, driven by its semantic state.
 *
 * This is the moving half of the renderer boundary. Callers still pass only a
 * semantic state; how that state moves lives here, so when pre-rendered frames
 * arrive they replace this without touching a screen.
 *
 * Squash and stretch is deliberately procedural rather than drawn. The sprite
 * backlog says so explicitly: deformation frames should not be commissioned when
 * scale and rotation on the existing art will do it.
 *
 * Everything animates `transform` and `opacity` only, with `useNativeDriver`, so
 * the habitat is never relaid out on an animation frame.
 */

type MotionSpec = Readonly<{
  /** Loop forever, or play once and settle. */
  loop: boolean;
  durationMs: number;
  /** Vertical travel in points. Negative is up. */
  lift: number;
  /** Squash factor at the peak. 1 is no squash. */
  squash: number;
  /** Rotation at the peak, in degrees. */
  tilt: number;
  /** How many times a one-shot repeats before settling. */
  beats: number;
}>;

const MOTION: Readonly<Record<PetAnimationState, MotionSpec>> = {
  // Ambient loops. Slow and small: this is breathing, not bouncing.
  idle: {
    loop: true,
    durationMs: 2400,
    lift: -3,
    squash: 1.025,
    tilt: 0,
    beats: 1,
  },
  sleepy: {
    loop: true,
    durationMs: 3800,
    lift: -2,
    squash: 1.05,
    tilt: 1.5,
    beats: 1,
  },
  // Slower and stiller than drowsy, with no tilt: deep breathing rather than a
  // dumpling nodding off. The two states share a sprite, so the motion is most of what
  // separates "tired" from "gone" before the mask fades in.
  asleep: {
    loop: true,
    durationMs: 5200,
    lift: -1,
    squash: 1.06,
    tilt: 0,
    beats: 1,
  },
  dirty: {
    loop: true,
    durationMs: 3000,
    lift: 0,
    squash: 0.97,
    tilt: -2,
    beats: 1,
  },
  happy: {
    loop: true,
    durationMs: 900,
    lift: -9,
    squash: 1.04,
    tilt: 0,
    beats: 1,
  },
  tongue: {
    loop: true,
    durationMs: 520,
    lift: -4,
    squash: 1.025,
    tilt: 2,
    beats: 1,
  },
  wave: {
    loop: true,
    durationMs: 340,
    lift: -3,
    squash: 1.015,
    tilt: -3,
    beats: 1,
  },
  squat: {
    loop: true,
    durationMs: 420,
    lift: 2,
    squash: 0.92,
    tilt: 0,
    beats: 1,
  },
  walk: {
    loop: true,
    durationMs: 620,
    lift: -4,
    squash: 1.02,
    tilt: 4,
    beats: 1,
  },

  // One-shots. These settle back to a resting pose when they finish.
  hop: {
    loop: false,
    durationMs: 420,
    lift: -46,
    squash: 1.12,
    tilt: 0,
    beats: 2,
  },
  eat: {
    loop: false,
    durationMs: 220,
    lift: 0,
    squash: 0.86,
    tilt: 0,
    beats: 3,
  },
  attention: {
    loop: false,
    durationMs: 260,
    lift: -5,
    squash: 1.03,
    tilt: 7,
    beats: 3,
  },
  annoyed: {
    loop: false,
    durationMs: 200,
    lift: 0,
    squash: 0.96,
    tilt: -9,
    beats: 3,
  },
  sick: {
    loop: false,
    durationMs: 480,
    lift: 3,
    squash: 0.9,
    tilt: -6,
    beats: 3,
  },
  cleaned: {
    loop: false,
    durationMs: 340,
    lift: -12,
    squash: 1.1,
    tilt: 0,
    beats: 1,
  },
  evolve: {
    loop: false,
    durationMs: 700,
    lift: -26,
    squash: 1.16,
    tilt: 0,
    beats: 2,
  },
  hatch: {
    loop: false,
    durationMs: 620,
    lift: -8,
    squash: 1.14,
    tilt: 0,
    beats: 1,
  },
  revive: {
    loop: false,
    durationMs: 700,
    lift: -14,
    squash: 1.12,
    tilt: 0,
    beats: 1,
  },

  // Deliberately still.
  dead: { loop: false, durationMs: 1, lift: 0, squash: 1, tilt: 0, beats: 1 },
};

export type PetMotion = Readonly<{
  transform: Animated.WithAnimatedArray<
    | { translateY: Animated.AnimatedInterpolation<number> }
    | { scaleX: Animated.AnimatedInterpolation<number> }
    | { scaleY: Animated.AnimatedInterpolation<number> }
    | { rotate: Animated.AnimatedInterpolation<string> }
  >;
}>;

/**
 * Returns a transform for the given state.
 *
 * With Reduce Motion on, the value is pinned at rest and no animation is started,
 * which is the hold-a-frame behavior the sprite contract asks for rather than a
 * faster version of the same movement.
 */
export function usePetMotion(state: PetAnimationState) {
  const reducedMotion = useReducedMotion();

  // Lazy useState rather than useRef: this is created once and read during render
  // to build the interpolations, which is what the refs lint rule forbids for refs.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const spec = MOTION[state];

    progress.setValue(0);

    if (reducedMotion || spec.durationMs <= 1) {
      return;
    }

    const beat = Animated.sequence([
      Animated.timing(progress, {
        duration: spec.durationMs,
        easing: Easing.inOut(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        duration: spec.durationMs,
        easing: Easing.inOut(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]);

    const animation = spec.loop
      ? Animated.loop(beat)
      : Animated.loop(beat, { iterations: spec.beats });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [progress, reducedMotion, state]);

  const spec = MOTION[state];

  return {
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spec.lift],
        }),
      },
      {
        // Stretching vertically has to pinch horizontally, or the dumpling reads
        // as growing rather than as breathing.
        scaleX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1 + (1 - spec.squash) * 0.6],
        }),
      },
      {
        scaleY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, spec.squash],
        }),
      },
      {
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${spec.tilt}deg`],
        }),
      },
    ],
  };
}
