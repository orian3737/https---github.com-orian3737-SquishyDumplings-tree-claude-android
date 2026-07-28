import type { AuthState } from '@/features/auth/auth-state';

import { routeForSession, type SessionState } from './session-state';

/**
 * Where the app should be, accounting for both who is signed in and what their
 * local state says.
 *
 * Kept as one pure function for the same reason `routeForSession` is: the gate
 * screen must hold no branching of its own, or the two drift and produce a flash
 * or a loop. Two loading states feed in and both must resolve to "stay put"
 * rather than to a destination, otherwise a cold launch shows sign-in for a frame
 * before the stored session finishes loading.
 */
export type AppRoute = '/(auth)' | '/(onboarding)' | '/habitat' | '/unreadable';

export function routeForApp(
  auth: AuthState,
  session: SessionState,
): AppRoute | null {
  switch (auth.status) {
    case 'loading':
      return null;
    case 'signed-out':
      return '/(auth)';
    case 'signed-in':
      return routeForSession(session);
  }
}

/**
 * True when the local cache must be dropped.
 *
 * Signing out has to clear the device's copy of the dumpling. Leaving it would
 * show the previous player's pet to the next person to sign in on this phone, and
 * would make the sync resolver reconcile two different owners' state — which it
 * handles, but only by discarding someone's progress.
 */
export function shouldClearLocalCache(
  previous: AuthState,
  next: AuthState,
): boolean {
  if (previous.status === 'signed-in' && next.status === 'signed-out') {
    return true;
  }

  // A different person signed in on the same device without a clean sign-out.
  return (
    previous.status === 'signed-in' &&
    next.status === 'signed-in' &&
    previous.userId !== next.userId
  );
}
