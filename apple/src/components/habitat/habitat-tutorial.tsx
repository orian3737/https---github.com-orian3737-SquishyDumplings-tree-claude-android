import { useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

const lessons = [
  {
    eyebrow: '1 OF 4 · FEED',
    icon: '🥟',
    title: 'Toss a tasty bite',
    body: 'Choose Feed on the care wheel, then tap the center or flick upward. Your dumpling will waddle over and eat.',
    tip: 'Food fills hunger and gives a little energy.',
  },
  {
    eyebrow: '2 OF 4 · CLEAN',
    icon: '🫧',
    title: 'Keep the habitat cozy',
    body: 'Choose Clean, then tap a mess or scrub across it. Clean everything before trying on a new wrapper.',
    tip: 'Messes stay safely above the care wheel.',
  },
  {
    eyebrow: '3 OF 4 · PET',
    icon: '💕',
    title: 'Give gentle pets',
    body: 'Rub across your dumpling or tap them once. Hearts mean they loved the attention.',
    tip: 'Petting uses a little energy, so let sleepy buns rest.',
  },
  {
    eyebrow: '4 OF 4 · SLEEP',
    icon: '💤',
    title: 'Let tired buns snooze',
    body: 'At zero energy, your dumpling stops wandering and enters Do Not Disturb mode. A full nap restores some energy automatically.',
    tip: 'You can still clean quietly while they sleep.',
  },
] as const;

export function HabitatTutorial({
  onComplete,
  visible,
}: {
  onComplete(): void;
  visible: boolean;
}) {
  const [index, setIndex] = useState(0);
  const insets = useSafeAreaInsets();
  const lesson = lessons[index] ?? lessons[0];
  const last = index === lessons.length - 1;

  const stopPropagation = (event: GestureResponderEvent) => {
    event.stopPropagation();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onComplete}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        accessibilityViewIsModal
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(61, 42, 31, 0.62)',
          flex: 1,
          justifyContent: 'flex-end',
          paddingBottom: Math.max(insets.bottom, 16),
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
        }}
      >
        <Pressable
          accessibilityLabel="Skip habitat tutorial"
          onPress={onComplete}
          style={{ inset: 0, position: 'absolute' }}
        />

        <Pressable
          accessibilityLabel={`${lesson.title}. ${lesson.body}`}
          onPress={stopPropagation}
          style={{
            backgroundColor: colors.paper,
            borderColor: 'rgba(109, 76, 65, 0.12)',
            borderCurve: 'continuous',
            borderRadius: 30,
            borderWidth: 1,
            maxWidth: 430,
            padding: 22,
            shadowColor: '#382218',
            shadowOffset: { height: 12, width: 0 },
            shadowOpacity: 0.28,
            shadowRadius: 24,
            width: '100%',
          }}
        >
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                color: colors.amberDeep,
                fontSize: 12,
                fontWeight: '900',
                letterSpacing: 0.8,
              }}
            >
              {lesson.eyebrow}
            </Text>
            <Pressable
              accessibilityLabel="Skip tutorial"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onComplete}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  fontWeight: '800',
                }}
              >
                Skip
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              alignItems: 'center',
              backgroundColor: colors.cream,
              borderCurve: 'continuous',
              borderRadius: 24,
              height: 88,
              justifyContent: 'center',
              marginTop: 18,
              width: 88,
            }}
          >
            <Text style={{ fontSize: 46 }}>{lesson.icon}</Text>
          </View>

          <Text
            style={{
              color: colors.ink,
              fontSize: 26,
              fontWeight: '900',
              letterSpacing: -0.5,
              marginTop: 16,
            }}
          >
            {lesson.title}
          </Text>
          <Text
            style={{
              color: colors.brownSoft,
              fontSize: 16,
              fontWeight: '600',
              lineHeight: 23,
              marginTop: 8,
            }}
          >
            {lesson.body}
          </Text>

          <View
            style={{
              backgroundColor: '#fff0c7',
              borderCurve: 'continuous',
              borderRadius: 16,
              marginTop: 16,
              paddingHorizontal: 13,
              paddingVertical: 11,
            }}
          >
            <Text
              style={{
                color: colors.brown,
                fontSize: 13,
                fontWeight: '800',
                lineHeight: 18,
              }}
            >
              {lesson.tip}
            </Text>
          </View>

          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: 10,
              marginTop: 20,
            }}
          >
            {index > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setIndex((current) => current - 1)}
                style={{
                  alignItems: 'center',
                  borderColor: '#e7d5c8',
                  borderCurve: 'continuous',
                  borderRadius: 18,
                  borderWidth: 1,
                  justifyContent: 'center',
                  minHeight: 52,
                  paddingHorizontal: 18,
                }}
              >
                <Text style={{ color: colors.brown, fontWeight: '900' }}>
                  Back
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (last) {
                  onComplete();
                } else {
                  setIndex((current) => current + 1);
                }
              }}
              style={{
                alignItems: 'center',
                backgroundColor: colors.amber,
                borderCurve: 'continuous',
                borderRadius: 18,
                flex: 1,
                justifyContent: 'center',
                minHeight: 52,
                paddingHorizontal: 20,
              }}
            >
              <Text
                style={{
                  color: '#513817',
                  fontSize: 16,
                  fontWeight: '900',
                }}
              >
                {last ? 'Start caring' : 'Next'}
              </Text>
            </Pressable>
          </View>

          <View
            accessibilityLabel={`Tutorial page ${index + 1} of ${lessons.length}`}
            style={{
              alignSelf: 'center',
              flexDirection: 'row',
              gap: 6,
              marginTop: 16,
            }}
          >
            {lessons.map((entry, dotIndex) => (
              <View
                key={entry.eyebrow}
                style={{
                  backgroundColor:
                    dotIndex === index ? colors.amberDeep : '#dfd2c8',
                  borderRadius: 999,
                  height: 7,
                  width: dotIndex === index ? 22 : 7,
                }}
              />
            ))}
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}
