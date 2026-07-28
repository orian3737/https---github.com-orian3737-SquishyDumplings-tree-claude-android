import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACTION_WHEEL_HEIGHT,
  ActionWheel,
  type WheelAction,
  type WheelFlick,
} from '@/components/habitat/action-wheel';
import {
  DoNotDisturbSign,
  SIGN_HEIGHT,
  SIGN_WIDTH,
} from '@/components/habitat/do-not-disturb-sign';
import { GlassSurface } from '@/components/habitat/glass-surface';
import { HabitatTutorial } from '@/components/habitat/habitat-tutorial';
import { Particles } from '@/components/habitat/particles';
import {
  FLOOR_TOP_RATIO,
  HabitatScene,
} from '@/components/habitat/habitat-scene';
import { NeedHud } from '@/components/habitat/need-hud';
import { RubSurface } from '@/components/habitat/rub-surface';
import { PoopPiles } from '@/components/habitat/poop-piles';
import { ThrownFoodItem } from '@/components/habitat/thrown-food';
import { PET_ART_CENTER_OFFSET } from '@/components/pet-art-geometry';
import { PetRenderer } from '@/components/pet-renderer';
import {
  hygieneSummary,
  isFullyExhausted,
  moodOf,
  PROVISIONAL_HYGIENE_CONFIG,
  RARITY_TABLE,
  poopPileCount,
  restingAnimationStateFor,
} from '@/domain';
import { useHabitatLoop } from '@/features/habitat/use-habitat-loop';
import { usePet, useSession } from '@/features/session/session-provider';
import { useQuietHours } from '@/hooks/use-quiet-hours';
import { skinDisplayName } from '@/services/pet/skin-catalog';
import { sceneColors } from '@/theme/scene-colors';

const hygiene = PROVISIONAL_HYGIENE_CONFIG;

const floorTopFor = (height: number) => height * FLOOR_TOP_RATIO;

const PET_SIZE = 184;

/**
 * Breathing room between the deepest food or mess and the top of the action wheel,
 * in points. Roughly half a food sprite, so an item at the limit still reads as
 * sitting on the floor rather than tucked behind the glass.
 */
const FLOOR_CLEARANCE = 28;

/**
 * The habitat.
 *
 * FR-4: the environment is the screen. The scene fills it edge to edge under the
 * status bar, and everything else — needs, the action wheel, the settings control —
 * overlays that room inside the safe area.
 *
 * Cleanliness has no meter here by design. It is carried entirely by the piles on
 * the floor, with `hygieneSummary` giving a screen reader the same information.
 */
export default function HabitatScreen() {
  const pet = usePet();
  const { completeTutorial, persist, tutorialStatus } = useSession();
  const insets = useSafeAreaInsets();

  const [size, setSize] = useState({ height: 0, width: 0 });
  const [selected, setSelected] = useState<WheelAction>('feed');
  const wardrobeTransitioning = useRef(false);
  /**
   * Two different sleeps, and the player should not have to tell them apart.
   *
   * `fullyExhausted` is the stamina floor — spent, and recovering. `inQuietHours`
   * is the nightly stasis. Both mean "do not disturb", so the habitat treats them
   * the same and only the wording of the notice differs.
   */
  const fullyExhausted = isFullyExhausted(pet.needs);
  const inQuietHours = useQuietHours(pet.sleepSchedule);
  const fullyAsleep = fullyExhausted || inQuietHours;

  /**
   * How deep into the floor food and messes may go.
   *
   * The action wheel is drawn over the bottom of the room, so anything that lands
   * under it is invisible and untappable. Derived from the real layout rather than
   * guessed at, so it stays correct across device sizes and safe-area insets — and
   * so a taller wheel cannot silently start swallowing food.
   */
  const wheelReserve = insets.bottom + 8 + ACTION_WHEEL_HEIGHT;
  const maxLandingY = (() => {
    const top = floorTopFor(size.height);
    const band = size.height - top;
    if (band <= 0) {
      return undefined;
    }

    return Math.min(
      0.9,
      Math.max(
        0.25,
        (size.height - wheelReserve - FLOOR_CLEARANCE - top) / band,
      ),
    );
  })();

  const {
    activity,
    beginRub,
    beginScrub,
    expireParticle,
    food,
    particles,
    petOnce,
    petX,
    petY,
    piles,
    removePile,
    rubMove,
    scrubMove,
    throwFood,
  } = useHabitatLoop({
    pet,
    onPetChange: (next) => void persist(next),
    maxLandingY,
    asleep: fullyAsleep,
  });

  // Reset the navigation lock after the sheet is dismissed. The lock prevents one
  // energetic flick from pushing two wardrobe sheets, which can leave a blank
  // native form sheet on top.
  useFocusEffect(
    useCallback(() => {
      wardrobeTransitioning.current = false;
    }, []),
  );

  const handleSelect = useCallback((action: WheelAction) => {
    setSelected(action);
  }, []);

  const showSleepNotice = useCallback(() => {
    Alert.alert(
      `${pet.name} is fast asleep`,
      inQuietHours
        ? 'It is past their bedtime. Nothing will go wrong overnight — they wake up rested and no hungrier than you left them. You can change bedtime in Settings.'
        : 'Energy is empty. Do not disturb — this little nap will restore some energy.',
      [{ text: 'Let them sleep' }],
    );
  }, [inQuietHours, pet.name]);

  /** Acting on the centre segment: what "flick up" or tapping the selection does. */
  const handleFlick = useCallback(
    (action: WheelAction, flick: WheelFlick | null) => {
      if (fullyAsleep && action !== 'clean') {
        showSleepNotice();
        return;
      }
      if (action === 'feed') {
        // The flick aims the throw. A tap has no direction, and the loop centres
        // that case rather than pretending to have read one.
        throwFood(flick ?? undefined);
        return;
      }
      if (action === 'wardrobe') {
        if (wardrobeTransitioning.current) {
          return;
        }
        if (
          piles.length > 0 ||
          poopPileCount(pet.needs.cleanliness, hygiene) > 0
        ) {
          Alert.alert(
            'Clean up first',
            'Clean the habitat before changing wrappers!',
            [{ text: 'Got it' }],
          );
          return;
        }
        wardrobeTransitioning.current = true;
        router.push('/wardrobe');
      }
      // Clean needs no action here: selecting it emphasises the piles, and the
      // piles themselves are the tap targets.
    },
    [
      fullyAsleep,
      pet.needs.cleanliness,
      piles.length,
      showSleepNotice,
      throwFood,
    ],
  );

  const handleRubStart = useCallback(() => {
    if (fullyAsleep) {
      return;
    }
    beginRub();
  }, [beginRub, fullyAsleep]);

  const handleRubMove = useCallback(
    (dx: number, dy: number) => {
      if (!fullyAsleep) {
        rubMove(dx, dy);
      }
    },
    [fullyAsleep, rubMove],
  );

  const handlePetOnce = useCallback(() => {
    if (fullyAsleep) {
      showSleepNotice();
      return;
    }
    petOnce();
  }, [fullyAsleep, petOnce, showSleepNotice]);

  const floorTop = floorTopFor(size.height);
  const floorHeight = Math.max(0, size.height - floorTop);
  // Sleep outranks any leftover activity. The loop stops scheduling once it is
  // asleep, but a task that was already in flight can leave `activity` behind, and a
  // dumpling caught mid-hop under its own Do Not Disturb sign undoes the whole scene.
  const petState = fullyAsleep
    ? restingAnimationStateFor(pet, true)
    : (activity ?? restingAnimationStateFor(pet, inQuietHours));

  // Feet land on the floor at the current depth, and standing further back reads as
  // slightly smaller. Without the scale the room looks flat once the pet can move in
  // two directions.
  const depthScale = 0.86 + petY * 0.2;
  const petSize = PET_SIZE * depthScale;
  const petFeetY = floorTop + petY * floorHeight;

  return (
    <View
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={{ backgroundColor: sceneColors.wall, flex: 1 }}
    >
      {/* The habitat stays anchored while native sheets animate above it. */}
      <View style={{ inset: 0, position: 'absolute' }}>
        <View style={{ position: 'absolute', inset: 0 }}>
          <HabitatScene height={size.height} width={size.width} />
        </View>

        {/* The dumpling, standing on the floor band and walking along it. */}
        <RubSurface
          accessibilityHint="Rub across your dumpling to pet it, or activate this to pet it once"
          accessibilityLabel="Your dumpling"
          onActivate={handlePetOnce}
          onRubMove={handleRubMove}
          onRubStart={handleRubStart}
          style={{
            left: `${petX * 100}%`,
            position: 'absolute',
            top: petFeetY - petSize,
            transform: [{ translateX: -petSize / 2 }],
          }}
        >
          <PetRenderer size={petSize} state={petState} />
        </RubSurface>

        {/* Planted at the dumpling's feet, so it stands in front of it on the floor
            and shrinks with depth like everything else in the room.

            Both offsets use the sign's unscaled size on purpose. `depthScale` is
            applied inside the sign as a transform about its bottom edge, which leaves
            the layout box full-size and pins that box's bottom centre — so scaling it
            here again would sink the base below the floor and slide it off centre as
            the dumpling walks back. The extra nudge is the art's own off-centre
            centre, so the sign stands in front of the face and not the frame. */}
        {fullyAsleep ? (
          <View
            style={{
              left: `${petX * 100}%`,
              position: 'absolute',
              top: petFeetY + 2 - SIGN_HEIGHT,
              transform: [
                {
                  translateX: petSize * PET_ART_CENTER_OFFSET - SIGN_WIDTH / 2,
                },
              ],
            }}
          >
            <DoNotDisturbSign name={pet.name} scale={depthScale} />
          </View>
        ) : null}

        {/* Food and messes share the floor band. */}
        <View
          accessibilityLabel={hygieneSummary(pet.needs.cleanliness, hygiene)}
          style={{
            bottom: 0,
            left: 0,
            position: 'absolute',
            right: 0,
            top: floorTop,
          }}
        >
          {food.map((entry) => (
            <ThrownFoodItem
              food={entry}
              habitatHeight={size.height}
              habitatWidth={size.width}
              key={entry.id}
            />
          ))}

          <PoopPiles
            onScrubMove={scrubMove}
            onScrubStart={beginScrub}
            onTap={removePile}
            piles={piles}
          />

          <Particles onExpire={expireParticle} particles={particles} />
        </View>
      </View>

      {/* Overlays stay inside the safe area while native sheets animate above. */}
      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          justifyContent: 'space-between',
          paddingBottom: insets.bottom + 8,
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
        }}
      >
        <View
          pointerEvents="box-none"
          style={{ flexDirection: 'row', justifyContent: 'space-between' }}
        >
          <View style={{ gap: 7 }}>
            {/* Name sits at the head of the same column as the need pills, in the
                same visual language, so the whole top-left reads as one block. */}
            <GlassSurface
              borderRadius={16}
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: sceneColors.outline,
                  fontSize: 17,
                  fontWeight: '900',
                }}
              >
                {pet.name}
              </Text>
              <Text
                style={{
                  color: sceneColors.outlineSoft,
                  fontSize: 10,
                  fontWeight: '700',
                }}
              >
                {skinDisplayName(pet.equippedSkinId)} ·{' '}
                {RARITY_TABLE[pet.rarity].displayName}
              </Text>
            </GlassSurface>

            <NeedHud needs={pet.needs} />
          </View>

          <View style={{ alignItems: 'flex-end', gap: 7 }}>
            <GlassSurface
              borderRadius={999}
              style={{ paddingHorizontal: 11, paddingVertical: 6 }}
            >
              <Text
                accessibilityLabel={`Mood ${moodOf(pet.needs)} out of 100`}
                style={{
                  color: sceneColors.outline,
                  fontVariant: ['tabular-nums'],
                  fontWeight: '900',
                }}
              >
                ☺️ {moodOf(pet.needs)}
              </Text>
            </GlassSurface>

            {/* Settings is a quiet corner control, deliberately not in the wheel:
                it owns account state and deletion, not moment-to-moment care. */}
            <Pressable
              accessibilityLabel="Settings"
              accessibilityRole="button"
              onPress={() => router.push('/settings')}
            >
              <GlassSurface
                borderRadius={999}
                style={{
                  alignItems: 'center',
                  height: 44,
                  justifyContent: 'center',
                  width: 44,
                }}
              >
                <Text style={{ fontSize: 18 }}>⚙️</Text>
              </GlassSurface>
            </Pressable>
          </View>
        </View>

        <View pointerEvents="box-none">
          <ActionWheel
            onFlick={handleFlick}
            onSelect={handleSelect}
            selected={selected}
          />
        </View>
      </View>

      <HabitatTutorial
        onComplete={() => void completeTutorial()}
        visible={tutorialStatus === 'pending'}
      />
    </View>
  );
}
