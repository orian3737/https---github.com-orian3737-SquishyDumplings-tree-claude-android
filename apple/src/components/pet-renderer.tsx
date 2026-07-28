import { Image, type ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import type { PetAnimationState } from '@/domain';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import {
  type ArtRect,
  SLEEP_MASK_PAD,
  SLEEP_MASK_STRAP,
} from './pet-art-geometry';
import { usePetMotion } from './use-pet-motion';

/**
 * The renderer boundary.
 *
 * Callers pass a semantic pet state and never an asset name. Today that resolves to
 * one of four project-owned PNGs; when pre-rendered sprite sequences arrive this
 * grows into ordered frame playback across composited layers without any caller
 * changing (ASSET_MANIFEST).
 */
type PrototypeFrame =
  'idle' | 'happy' | 'sleepy' | 'hop' | 'tongue' | 'wave' | 'squat';

const prototypeSources: Record<PrototypeFrame, ImageSource> = {
  idle: require('@/assets/prototype/dumpling_idle.png'),
  happy: require('@/assets/prototype/dumpling_happy.png'),
  sleepy: require('@/assets/prototype/dumpling_sleepy.png'),
  hop: require('@/assets/prototype/dumpling_hop.png'),
  tongue: require('@/assets/prototype/dumpling_tongue.png'),
  wave: require('@/assets/prototype/dumpling_wave.png'),
  squat: require('@/assets/prototype/dumpling_squat.png'),
};

/**
 * Prototype fallbacks, matching the table in ASSET_MANIFEST.
 *
 * Every semantic state resolves to something. A missing state must degrade to a
 * sensible frame rather than blanking the habitat, and the map is exhaustive so
 * adding a semantic state is a compile error here instead of a blank pet at
 * runtime.
 */
const PROTOTYPE_FALLBACKS: Record<PetAnimationState, PrototypeFrame> = {
  idle: 'idle',
  happy: 'happy',
  sleepy: 'sleepy',
  // Same closed-eye frame as drowsy; the mask is what distinguishes them until real
  // sleeping art arrives.
  asleep: 'sleepy',
  hop: 'hop',
  tongue: 'tongue',
  wave: 'wave',
  squat: 'squat',
  eat: 'happy',
  walk: 'idle',
  attention: 'happy',
  sick: 'idle',
  annoyed: 'idle',
  dirty: 'idle',
  cleaned: 'happy',
  evolve: 'hop',
  dead: 'idle',
  hatch: 'idle',
  revive: 'happy',
};

/** Human-readable state, for the accessibility label. */
const STATE_DESCRIPTIONS: Record<PetAnimationState, string> = {
  idle: 'resting',
  happy: 'happy',
  sleepy: 'sleepy',
  asleep: 'fast asleep',
  hop: 'hopping',
  tongue: 'sticking its tongue out',
  wave: 'waving hello',
  squat: 'doing a squat',
  eat: 'eating',
  walk: 'walking',
  attention: 'enjoying attention',
  sick: 'queasy',
  annoyed: 'had enough',
  dirty: 'uncomfortable',
  cleaned: 'freshly cleaned',
  evolve: 'evolving',
  dead: 'not doing well',
  hatch: 'about to appear',
  revive: 'coming back',
};

/**
 * The sleep mask's palette.
 *
 * Cool periwinkle against the art's warm cream, because the mask has to read as an
 * object placed on the dumpling rather than as part of it. Kept here rather than in
 * `scene-colors` — that palette is the room, and this belongs to the pet.
 */
const MASK_FILL = '#8d8ab5';
const MASK_OUTLINE = '#635f90';
const MASK_STRAP = '#7a76a4';
const MASK_SHEEN = 'rgba(255, 255, 255, 0.42)';

/**
 * The mask fades on the same beat as the sprite cross-fade below it.
 *
 * These have to match. The sleepy frame sits higher in its box than the waking
 * frames, so while the two cross-fade the mask is briefly over art it was not
 * measured against; a mask that outlasts the swap finishes that fade sitting on a
 * forehead.
 */
const MASK_FADE_MS = 180;
const SPRITE_FADE_MS = MASK_FADE_MS;

/** Scale an art-space rect to points for the current sprite size. */
function rectStyle(rect: ArtRect, size: number) {
  return {
    height: size * rect.height,
    left: size * rect.left,
    top: size * rect.top,
    width: size * rect.width,
  } as const;
}

type PetRendererProps = {
  state?: PetAnimationState;
  size?: number;
};

export function PetRenderer({ state = 'idle', size = 220 }: PetRendererProps) {
  const motion = usePetMotion(state);
  const reducedMotion = useReducedMotion();

  // Lazy useState rather than useRef, matching `usePetMotion`: this is created once
  // and read during render to build the interpolation.
  const [maskFade] = useState(() => new Animated.Value(0));
  // Only genuine sleep, never mere drowsiness. A mask on an awake, pettable dumpling
  // tells the player it cannot be touched, which is a lie about the controls.
  const wearingMask = state === 'asleep';

  useEffect(() => {
    const target = wearingMask ? 1 : 0;

    // A mask that pops on mid-yawn reads as a glitch; a short fade reads as drifting
    // off. Under Reduce Motion it just snaps, like every other effect here.
    if (reducedMotion) {
      maskFade.setValue(target);
      return;
    }

    const animation = Animated.timing(maskFade, {
      duration: MASK_FADE_MS,
      easing: Easing.out(Easing.quad),
      toValue: target,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [maskFade, reducedMotion, wearingMask]);

  return (
    <View
      accessibilityLabel={`Dumpling, ${STATE_DESCRIPTIONS[state]}`}
      style={{
        alignItems: 'center',
        height: size,
        justifyContent: 'center',
        width: size,
      }}
    >
      {/* The sprite and anything worn over it move as one, so the mask squashes and
          tilts with the dumpling instead of sliding around on top of it. */}
      <Animated.View
        style={{
          height: size,
          // Anchor the squash at the feet so a stretching dumpling grows upward
          // instead of sinking through the floor.
          transformOrigin: 'bottom',
          width: size,
          ...motion,
        }}
      >
        <Image
          contentFit="contain"
          source={prototypeSources[PROTOTYPE_FALLBACKS[state]]}
          style={{
            height: size,
            // The dimmed treatment ASSET_MANIFEST specifies for the death state,
            // until real art exists for it.
            opacity: state === 'dead' ? 0.45 : 1,
            width: size,
          }}
          transition={SPRITE_FADE_MS}
        />

        <SleepMask fade={maskFade} size={size} />
      </Animated.View>
    </View>
  );
}

/**
 * The sleep mask.
 *
 * A view effect rather than a painted frame, which is what the sprite backlog asks
 * for while the prototype PNGs stand in: one mask that sits correctly on every state
 * beats commissioning a masked variant of each.
 *
 * Geometry is expressed as fractions of the sprite box so it tracks the art at any
 * size, and it hangs off the measured centre and eye line in `pet-art-geometry` rather
 * than off the middle of the frame — the art is not centred in its box, and a mask
 * built symmetric around 0.5 sits noticeably left of the face.
 */
function SleepMask({ fade, size }: { fade: Animated.Value; size: number }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{ inset: 0, opacity: fade, position: 'absolute' }}
    >
      <View
        style={{
          backgroundColor: MASK_STRAP,
          borderRadius: size * 0.02,
          position: 'absolute',
          ...rectStyle(SLEEP_MASK_STRAP, size),
        }}
      />

      <View
        style={{
          backgroundColor: MASK_FILL,
          borderColor: MASK_OUTLINE,
          borderCurve: 'continuous',
          borderRadius: size * 0.075,
          borderWidth: Math.max(1, size * 0.009),
          position: 'absolute',
          ...rectStyle(SLEEP_MASK_PAD, size),
        }}
      >
        {/* A satin highlight, so the pad reads as fabric rather than as a bar. */}
        <View
          style={{
            backgroundColor: MASK_SHEEN,
            borderRadius: size * 0.02,
            height: size * 0.022,
            left: size * 0.06,
            position: 'absolute',
            top: size * 0.028,
            width: size * 0.16,
          }}
        />
      </View>
    </Animated.View>
  );
}
