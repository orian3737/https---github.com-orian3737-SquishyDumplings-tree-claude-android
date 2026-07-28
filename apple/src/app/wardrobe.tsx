import { ScrollView, Text, View } from 'react-native';

import { PetRenderer } from '@/components/pet-renderer';
import { SectionCard } from '@/components/section-card';
import { RARITY_TABLE } from '@/domain';
import { usePet } from '@/features/session/session-provider';
import { findSkin, skinDisplayName } from '@/services/pet/skin-catalog';
import { colors } from '@/theme/colors';

/**
 * Read-only for now. PR 8 turns this into the habitat sheet with live preview and
 * an explicit confirm. Nothing is equippable yet because rolls do not exist, so
 * selectable-looking rows would promise an action that does nothing.
 */
export default function WardrobeScreen() {
  const pet = usePet();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.cream }}
      contentContainerStyle={{ gap: 18, padding: 18, paddingBottom: 40 }}
    >
      <SectionCard eyebrow="One dumpling" title={`${pet.name}'s wrappers`}>
        <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>
          Every wrapper belongs to {pet.name}. Rolls change how they look — they
          never create another dumpling.
        </Text>
      </SectionCard>

      <View style={{ gap: 12 }}>
        {pet.unlockedSkinIds.map((skinId) => {
          const equipped = skinId === pet.equippedSkinId;
          const rarity = findSkin(skinId)?.rarity ?? null;

          return (
            <View
              accessibilityLabel={`${skinDisplayName(skinId)}${
                rarity === null ? '' : `, ${RARITY_TABLE[rarity].displayName}`
              }${equipped ? ', currently worn' : ''}`}
              key={skinId}
              style={{
                alignItems: 'center',
                backgroundColor: colors.paper,
                borderColor: equipped ? colors.amberDeep : '#ead9cc',
                borderCurve: 'continuous',
                borderRadius: 22,
                borderWidth: equipped ? 2 : 1,
                flexDirection: 'row',
                gap: 14,
                padding: 12,
              }}
            >
              <PetRenderer size={84} state="idle" />

              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  selectable
                  style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}
                >
                  {skinDisplayName(skinId)}
                </Text>
                {rarity === null ? null : (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    {RARITY_TABLE[rarity].displayName}
                  </Text>
                )}
              </View>

              {equipped ? (
                <Text
                  style={{
                    color: colors.amberDeep,
                    fontSize: 13,
                    fontWeight: '900',
                  }}
                >
                  WORN
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <SectionCard eyebrow="Skin rolls" title="Earned coins only">
        <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>
          Tier previews, exact odds, duplicate rules, and the steam-cloud reveal
          arrive with the coin economy. Coins are never purchasable, and they
          never affect food.
        </Text>
      </SectionCard>
    </ScrollView>
  );
}
