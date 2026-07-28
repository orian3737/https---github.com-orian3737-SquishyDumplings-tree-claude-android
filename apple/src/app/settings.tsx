import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { SectionCard } from '@/components/section-card';
import { BedtimeSetting } from '@/components/settings/bedtime-setting';
import { setSleepSchedule, type SleepSchedule } from '@/domain';
import { useAuth } from '@/features/auth/auth-provider';
import { useSession } from '@/features/session/session-provider';
import { colors } from '@/theme/colors';

const rows = [
  ['Animations', 'PNG prototype · Rive planned'],
  ['Backend', 'Supabase audited · not connected'],
  ['Notifications', 'Decision pending'],
  ['Picture in Picture', 'Mini habitat spike planned'],
] as const;

export default function SettingsScreen() {
  const { state, persist, syncNow } = useSession();
  const { state: auth, signOut } = useAuth();
  const pet = state.status === 'ready' ? state.pet : null;
  const email = auth.status === 'signed-in' ? auth.email : null;

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'Your dumpling stays safe in the cloud and comes back when you sign in. This device forgets it until then.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            // Back up first, so anything cared for since the last sync is not
            // stranded on a device that is about to forget it.
            void syncNow()
              .catch(() => undefined)
              .finally(() => void signOut());
          },
        },
      ],
    );
  };

  const handleScheduleChange = (next: SleepSchedule) => {
    if (pet === null) {
      return;
    }
    void persist(setSleepSchedule(pet, next));
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.cream }}
      contentContainerStyle={{ gap: 18, padding: 18, paddingBottom: 40 }}
    >
      {auth.status === 'signed-in' ? (
        <SectionCard eyebrow="Account" title={email ?? 'Signed in'}>
          <View style={{ gap: 14 }}>
            <Text style={{ color: colors.muted, lineHeight: 21 }}>
              Your dumpling is backed up to your account, so a new phone picks
              up where this one left off.
            </Text>

            <Pressable
              accessibilityLabel="Sign out"
              accessibilityRole="button"
              onPress={confirmSignOut}
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor: pressed ? '#f0dcd0' : '#f7ece3',
                borderRadius: 14,
                justifyContent: 'center',
                minHeight: 48,
              })}
            >
              <Text style={{ color: colors.danger, fontWeight: '900' }}>
                Sign out
              </Text>
            </Pressable>
          </View>
        </SectionCard>
      ) : null}

      {pet !== null ? (
        <SectionCard eyebrow="Quiet hours" title="Bedtime">
          <BedtimeSetting
            onChange={handleScheduleChange}
            schedule={pet.sleepSchedule}
          />
        </SectionCard>
      ) : null}

      <SectionCard eyebrow="Foundation build" title="Project status">
        <View style={{ gap: 13 }}>
          {rows.map(([label, value]) => (
            <View
              key={label}
              style={{
                borderBottomColor: '#ead9cc',
                borderBottomWidth: 1,
                gap: 4,
                paddingBottom: 12,
              }}
            >
              <Text
                selectable
                style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}
              >
                {label}
              </Text>
              <Text selectable style={{ color: colors.muted }}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="This preview is local only">
        <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>
          No account, database, purchase, notification, or PiP action is active
          yet. The current build validates navigation, layout, and the
          replaceable pet-renderer boundary.
        </Text>
      </SectionCard>
    </ScrollView>
  );
}
