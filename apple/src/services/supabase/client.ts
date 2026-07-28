import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { expoKeyValueStore } from '@/services/storage/expo-kv-store';

import type { Database } from './database.types';
import { normalizeSupabaseUrl } from './supabase-url';

/**
 * The one Supabase client.
 *
 * Nothing in `src/components` or `src/app` may import this. Screens reach data
 * through feature hooks and repositories (BUILD_SPEC section 4), which is what
 * keeps the app testable without a network and lets the local and remote
 * repositories stay interchangeable.
 */

/**
 * Validated at module load rather than at first use.
 *
 * A missing key should be a loud failure the first time anyone runs the app, not
 * a confusing 401 somewhere deep in a sync months later. Only `EXPO_PUBLIC_`
 * values reach the bundle, and both of these are safe to ship: the publishable
 * key is protected by Row Level Security, not by secrecy.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `${name} is missing. Copy apple/.env.example to apple/.env and fill it in.`,
    );
  }

  return value.trim();
}

export const SUPABASE_URL = normalizeSupabaseUrl(
  requireEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
);

const SUPABASE_PUBLISHABLE_KEY = requireEnv(
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export type AppSupabaseClient = SupabaseClient<Database>;

export const supabase: AppSupabaseClient = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      /**
       * The same SQLite-backed store the pet cache uses. One storage mechanism in
       * the app, reached through one port — a second one would be a second thing
       * to clear on sign-out and a second thing to get wrong.
       */
      storage: expoKeyValueStore,
      persistSession: true,
      autoRefreshToken: true,
      /**
       * There is no URL to read a session out of on a native client. Leaving this
       * on makes supabase-js look for browser globals that do not exist.
       */
      detectSessionInUrl: false,
    },
  },
);

/**
 * Refresh tokens only while the app is in front of the player.
 *
 * supabase-js otherwise keeps a timer alive in the background, which iOS will
 * suspend anyway — and a refresh that fires while suspended can land as a failed
 * request and a spurious signed-out state on resume. Starting and stopping with
 * the app lifecycle is what the Supabase React Native guidance calls for.
 *
 * Registered once at module load: this is process-wide, not per-component.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
    return;
  }

  void supabase.auth.stopAutoRefresh();
});
