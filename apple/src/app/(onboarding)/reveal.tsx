import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';

import { DumplingSteamer } from '@/components/onboarding/dumpling-steamer';
import { SteamBurst } from '@/components/onboarding/steam-burst';
import { PetRenderer } from '@/components/pet-renderer';
import {
  isDiet,
  normalizePetName,
  RARITY_TABLE,
  rarityDropPercentLabel,
  type Diet,
  type Rarity,
} from '@/domain';
import { useSession } from '@/features/session/session-provider';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { colors } from '@/theme/colors';

const STEAM_RISE_MS = 1250;
const STEAM_HOLD_MS = 450;
const STEAM_COVER_PROGRESS = 0.7;

type RevealPhase =
  | Readonly<{ phase: 'closed' }>
  | Readonly<{ phase: 'opening' }>
  | Readonly<{
      phase: 'revealed';
      rarity: Rarity;
      skinName: string;
      name: string;
    }>
  | Readonly<{ phase: 'failed'; message: string }>;

/**
 * The steam box: the first reveal.
 *
 * The dumpling is created and saved here, before any navigation (FR-3). Repeated
 * taps cannot produce a second dumpling — the button disables on the first tap and
 * the session layer additionally re-reads storage and refuses a concurrent hatch,
 * so the guarantee does not depend on this screen's state alone.
 */
export default function RevealScreen() {
  const params = useLocalSearchParams<{ name?: string; diet?: string }>();
  const { hatch } = useSession();
  const reducedMotion = useReducedMotion();

  const [state, setState] = useState<RevealPhase>({ phase: 'closed' });

  // Lazy useState rather than useRef: these are created once and read during
  // render to build the interpolations, which is exactly what the refs lint rule
  // (correctly) forbids for refs.
  const [steam] = useState(() => new Animated.Value(0));
  const [lid] = useState(() => new Animated.Value(0));

  const diet: Diet = isDiet(params.diet) ? params.diet : 'omnivore';

  // Normalize for display so the name shown here matches the one the domain
  // actually stores. Before the hatch this previews the typed name; afterwards the
  // saved pet's name is the single source of truth.
  const typedName = normalizePetName(params.name ?? '');
  const name = state.phase === 'revealed' ? state.name : typedName;

  const open = useCallback(async () => {
    if (state.phase !== 'closed') {
      return;
    }
    setState({ phase: 'opening' });

    const result = await hatch({ diet, name: typedName });

    if (result.outcome === 'hatched') {
      setState({
        phase: 'revealed',
        name: result.pet.name,
        rarity: result.pet.rarity,
        skinName: result.roll.skin.displayName,
      });
      return;
    }

    if (result.outcome === 'already-hatched') {
      // Someone already has a dumpling. Go meet them rather than implying a reroll.
      router.replace('/habitat');
      return;
    }

    if (result.outcome === 'busy') {
      return;
    }

    setState({
      phase: 'failed',
      message:
        result.outcome === 'invalid-name'
          ? 'That name did not come through. Go back and try another.'
          : result.error,
    });
  }, [diet, hatch, state.phase, typedName]);

  useEffect(() => {
    if (state.phase !== 'revealed') {
      return;
    }

    if (reducedMotion) {
      // Reduce Motion: hold the end state rather than playing the cloud (FR-9).
      steam.setValue(1);
      lid.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(lid, {
        duration: STEAM_RISE_MS,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(steam, {
          duration: STEAM_RISE_MS,
          easing: Easing.out(Easing.quad),
          toValue: STEAM_COVER_PROGRESS,
          useNativeDriver: true,
        }),
        Animated.delay(STEAM_HOLD_MS),
        Animated.timing(steam, {
          duration: 700,
          easing: Easing.in(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [lid, reducedMotion, state.phase, steam]);

  if (state.phase === 'failed') {
    return (
      <View
        style={{
          backgroundColor: colors.cream,
          flex: 1,
          gap: 16,
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '900' }}>
          The lid stuck
        </Text>
        <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>
          {state.message}
        </Text>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{
            alignItems: 'center',
            backgroundColor: colors.amber,
            borderCurve: 'continuous',
            borderRadius: 18,
            justifyContent: 'center',
            minHeight: 52,
          }}
        >
          <Text
            style={{ color: colors.brown, fontSize: 17, fontWeight: '900' }}
          >
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const revealed = state.phase === 'revealed';

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.cream,
        flex: 1,
        gap: 20,
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <SteamBurst progress={steam} />

      <View
        style={{
          alignItems: 'center',
          height: 280,
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {revealed ? (
          <PetRenderer size={210} state="happy" />
        ) : (
          <Animated.View
            style={{
              transform: [
                {
                  translateY: lid.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -14],
                  }),
                },
              ],
            }}
          >
            <DumplingSteamer />
          </Animated.View>
        )}
      </View>

      {revealed ? (
        <>
          <View style={{ alignItems: 'center', gap: 7 }}>
            <Text
              accessibilityRole="header"
              style={{ color: colors.ink, fontSize: 30, fontWeight: '900' }}
            >
              Meet {name}
            </Text>
            <Text
              accessibilityLabel={`Wrapper: ${state.skinName}, ${
                RARITY_TABLE[state.rarity].displayName
              }, ${rarityDropPercentLabel(state.rarity)} chance`}
              style={{
                color: colors.brownSoft,
                fontSize: 16,
                fontWeight: '700',
              }}
            >
              {state.skinName}
            </Text>
            <View
              style={{
                backgroundColor: colors.lawnSoft,
                borderCurve: 'continuous',
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 7,
              }}
            >
              <Text style={{ color: colors.brown, fontWeight: '900' }}>
                {RARITY_TABLE[state.rarity].displayName} ·{' '}
                {rarityDropPercentLabel(state.rarity)}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityHint="Goes to the habitat"
            accessibilityLabel={`Take ${name} home`}
            accessibilityRole="button"
            onPress={() => router.replace('/habitat')}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: pressed ? colors.amberDeep : colors.amber,
              borderCurve: 'continuous',
              borderRadius: 20,
              justifyContent: 'center',
              minHeight: 58,
              paddingHorizontal: 34,
            })}
          >
            <Text
              style={{ color: colors.brown, fontSize: 18, fontWeight: '900' }}
            >
              Take {name} home
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text
            style={{
              color: colors.muted,
              fontSize: 16,
              lineHeight: 23,
              textAlign: 'center',
            }}
          >
            {state.phase === 'opening'
              ? 'Lifting the lid…'
              : `${name} is in there somewhere.`}
          </Text>

          <Pressable
            accessibilityHint="Opens the steamer and reveals your dumpling"
            accessibilityLabel="Open the steamer"
            accessibilityRole="button"
            accessibilityState={{ busy: state.phase === 'opening' }}
            disabled={state.phase === 'opening'}
            onPress={() => {
              void open();
            }}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor:
                state.phase === 'opening'
                  ? '#e8ded3'
                  : pressed
                    ? colors.amberDeep
                    : colors.amber,
              borderCurve: 'continuous',
              borderRadius: 20,
              justifyContent: 'center',
              minHeight: 58,
              paddingHorizontal: 34,
            })}
          >
            <Text
              style={{
                color:
                  state.phase === 'opening' ? colors.brownSoft : colors.brown,
                fontSize: 18,
                fontWeight: '900',
              }}
            >
              {state.phase === 'opening' ? 'Opening…' : 'Open the steamer'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
