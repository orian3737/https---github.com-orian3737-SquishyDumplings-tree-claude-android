import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DumplingSteamer } from '@/components/onboarding/dumpling-steamer';
import {
  DIETS,
  isValidPetName,
  MAX_PET_NAME_LENGTH,
  RARITIES,
  RARITY_TABLE,
  rarityDropPercentLabel,
  type Diet,
} from '@/domain';
import { colors } from '@/theme/colors';

const DIET_LABELS: Readonly<Record<Diet, { title: string; detail: string }>> = {
  omnivore: { title: 'Anything', detail: 'Pork chops, tofu, and scallions' },
  vegetarian: {
    title: 'Vegetarian',
    detail: 'Vegetables, tofu, and scallions',
  },
  vegan: { title: 'Vegan', detail: 'Vegetables, tofu, and scallions' },
};

/**
 * Naming and the diet choice.
 *
 * The diet defaults to omnivore and is one tap, never a gate (FR-3): the first
 * thing a new player does should not feel like filling in a form. Nothing is saved
 * here — the dumpling is created on the reveal screen, so backing out of this step
 * leaves no partial pet behind.
 */
export default function NameYourDumplingScreen() {
  const [name, setName] = useState('');
  const [diet, setDiet] = useState<Diet>('omnivore');

  const canContinue = isValidPetName(name);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ backgroundColor: colors.cream, flex: 1 }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 22, padding: 24, paddingTop: 72 }}
      >
        <View style={{ gap: 10 }}>
          {/* The real steamer, not 🧺 — that emoji is a laundry basket on iOS, and
              this is the first object the player ever sees. */}
          <DumplingSteamer scale={0.42} />
          <Text
            accessibilityRole="header"
            style={{ color: colors.ink, fontSize: 30, fontWeight: '900' }}
          >
            Someone&apos;s in the steamer
          </Text>
          <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>
            Give them a name before you lift the lid. You&apos;ll have this one
            dumpling for good — new wrappers change how they look, never who
            they are.
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text
            style={{ color: colors.brownSoft, fontSize: 13, fontWeight: '800' }}
          >
            NAME
          </Text>
          <TextInput
            accessibilityLabel="Your dumpling's name"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={MAX_PET_NAME_LENGTH}
            onChangeText={setName}
            placeholder="Bao"
            placeholderTextColor={colors.brownSoft}
            returnKeyType="done"
            style={{
              backgroundColor: colors.paper,
              borderColor: '#ead9cc',
              borderCurve: 'continuous',
              borderRadius: 18,
              borderWidth: 1,
              color: colors.ink,
              fontSize: 20,
              fontWeight: '800',
              minHeight: 56,
              paddingHorizontal: 16,
            }}
            value={name}
          />
        </View>

        <View style={{ gap: 10 }}>
          <Text
            style={{ color: colors.brownSoft, fontSize: 13, fontWeight: '800' }}
          >
            WHAT DO THEY EAT?
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            You can change this any time in settings.
          </Text>

          {DIETS.map((option) => {
            const selected = diet === option;
            const label = DIET_LABELS[option];

            return (
              <Pressable
                accessibilityHint={label.detail}
                accessibilityLabel={label.title}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option}
                onPress={() => setDiet(option)}
                style={{
                  backgroundColor: selected ? colors.lawnSoft : colors.paper,
                  borderColor: selected ? colors.lawn : '#ead9cc',
                  borderCurve: 'continuous',
                  borderRadius: 18,
                  borderWidth: selected ? 2 : 1,
                  gap: 3,
                  justifyContent: 'center',
                  minHeight: 60,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}
                >
                  {label.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {label.detail}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityHint="Opens the steamer to meet your dumpling"
          accessibilityLabel="Lift the lid"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
          disabled={!canContinue}
          onPress={() =>
            router.push({
              pathname: '/(onboarding)/reveal',
              params: { diet, name },
            })
          }
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: canContinue
              ? pressed
                ? colors.amberDeep
                : colors.amber
              : '#e8ded3',
            borderCurve: 'continuous',
            borderRadius: 20,
            justifyContent: 'center',
            minHeight: 58,
          })}
        >
          <Text
            style={{
              color: canContinue ? colors.brown : colors.brownSoft,
              fontSize: 18,
              fontWeight: '900',
            }}
          >
            Lift the lid
          </Text>
        </Pressable>

        {canContinue ? null : (
          <Text
            style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}
          >
            Pick a name to keep going.
          </Text>
        )}

        <WrapperOdds />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Odds disclosure, shown before the roll rather than after it.
 *
 * BUILD_SPEC section 12 requires exact odds to be disclosed before every
 * randomized reward, earned or paid. The first wrapper is randomized, so the
 * disclosure belongs on this screen — the one before the lid comes off. Values are
 * read from the rarity table so the displayed odds cannot drift from the roll.
 */
function WrapperOdds() {
  return (
    <View
      accessibilityLabel={`Wrapper odds: ${RARITIES.map(
        (rarity) =>
          `${RARITY_TABLE[rarity].displayName} ${rarityDropPercentLabel(rarity)}`,
      ).join(', ')}`}
      style={{
        backgroundColor: colors.paper,
        borderColor: '#ead9cc',
        borderCurve: 'continuous',
        borderRadius: 16,
        borderWidth: 1,
        gap: 7,
        padding: 14,
      }}
    >
      <Text
        style={{ color: colors.brownSoft, fontSize: 12, fontWeight: '800' }}
      >
        WRAPPER ODDS
      </Text>

      {RARITIES.map((rarity) => (
        <View
          key={rarity}
          style={{ flexDirection: 'row', justifyContent: 'space-between' }}
        >
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {RARITY_TABLE[rarity].displayName}
          </Text>
          <Text
            style={{
              color: colors.ink,
              fontSize: 13,
              fontVariant: ['tabular-nums'],
              fontWeight: '700',
            }}
          >
            {rarityDropPercentLabel(rarity)}
          </Text>
        </View>
      ))}
    </View>
  );
}
