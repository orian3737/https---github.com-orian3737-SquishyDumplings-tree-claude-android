import { ThemeProvider } from 'expo-router';
import Stack from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { LoadingScreen } from '@/components/loading-screen';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { SessionProvider } from '@/features/session/session-provider';
import { createPetRepository } from '@/services/pet/pet-repository';
import { createRemotePetRepository } from '@/services/pet/remote-pet-repository';
import { supabase } from '@/services/supabase/client';
import { expoKeyValueStore } from '@/services/storage/expo-kv-store';
import { createTutorialProgressRepository } from '@/services/tutorial/tutorial-progress';
import { colors } from '@/theme/colors';

const theme = {
  dark: false,
  colors: {
    primary: colors.amberDeep,
    background: colors.cream,
    card: colors.paper,
    text: colors.ink,
    border: '#ead9cc',
    notification: colors.danger,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '800' as const },
  },
};

/**
 * The root is a stack, not the tab bar, so onboarding can own the whole screen
 * without a tab bar sitting behind it. `index` is the session gate that decides
 * between onboarding and the habitat (FR-1).
 *
 * The repository is constructed here and injected, which keeps the native storage
 * module out of every layer above it.
 */
export default function RootLayout() {
  const repository = useMemo(() => createPetRepository(expoKeyValueStore), []);
  const tutorialRepository = useMemo(
    () => createTutorialProgressRepository(expoKeyValueStore),
    [],
  );
  const remoteRepository = useMemo(
    () => createRemotePetRepository(supabase),
    [],
  );

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <AuthProvider client={supabase}>
        <SessionProvider
          client={supabase}
          remote={remoteRepository}
          repository={repository}
          tutorialRepository={tutorialRepository}
        >
          <AppStack />
        </SessionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * The navigator, guarded by who is signed in.
 *
 * `Stack.Protected` rather than a redirect from the sign-in screen. Two places
 * making routing decisions is a redirect loop: the gate at `index` is not mounted
 * while the auth screen is, so the auth screen redirecting back to the gate and
 * the gate redirecting onward ping-pong until React gives up. A guard has one
 * authority — a route the guard rejects simply does not exist to navigate to.
 *
 * Separate from `RootLayout` because it has to read auth, and the provider that
 * supplies it is mounted by `RootLayout` itself.
 */
function AppStack() {
  const { state: auth } = useAuth();

  // Neither guard is meaningful yet. Holding the branded loading state here is
  // what stops a cold launch flashing the sign-in form before the stored session
  // has been read.
  if (auth.status === 'loading') {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />

      {/* The habitat owns the whole screen, status bar included, so the room
              reaches every edge. */}
      <Stack.Screen name="habitat" />

      {/* Wardrobe rises over the live habitat instead of replacing it, so a
              skin can be previewed on the dumpling in context. Native sheet
              presentation rather than a hand-rolled panel, so drag, dismiss, and
              accessibility come from the platform. */}
      <Stack.Screen
        name="wardrobe"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.55, 0.92],
          sheetCornerRadius: 28,
          sheetGrabberVisible: true,
        }}
      />

      <Stack.Screen
        name="settings"
        options={{ headerShown: true, title: 'Settings' }}
      />
      <Stack.Screen
        name="unreadable"
        options={{ headerShown: true, title: 'Something went wrong' }}
      />
    </Stack>
  );
}
