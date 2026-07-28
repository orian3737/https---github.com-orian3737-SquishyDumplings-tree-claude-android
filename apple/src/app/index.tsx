import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { LOADING_AUTH, type AuthState } from '@/features/auth/auth-state';
import {
  routeForApp,
  shouldClearLocalCache,
} from '@/features/session/app-route';
import { useSession } from '@/features/session/session-provider';

/**
 * The session gate.
 *
 * FR-1: a cold launch shows a lightweight branded loading state while local state
 * is restored, then every state has one deterministic destination. Both the route
 * and the cache rule come from tested pure functions, so this screen holds no
 * branching of its own and cannot drift from them.
 */
export default function SessionGate() {
  const { state: auth } = useAuth();
  const { state: session, clearLocal } = useSession();

  /**
   * The previous auth state, for spotting a change of identity.
   *
   * A ref rather than state: this exists only to compare against, and storing it
   * in state would re-render the gate on every token refresh for no reason.
   */
  const previousAuth = useRef<AuthState>(LOADING_AUTH);

  useEffect(() => {
    const previous = previousAuth.current;
    previousAuth.current = auth;

    if (shouldClearLocalCache(previous, auth)) {
      // Otherwise the next person to sign in on this phone sees the last one's
      // dumpling, and the sync resolver has to discard somebody's progress.
      void clearLocal();
    }
  }, [auth, clearLocal]);

  const route = routeForApp(auth, session);

  /**
   * Navigate from an effect keyed on the route string, rather than by rendering
   * `<Redirect>`.
   *
   * This screen re-renders on every auth event and every background sync now, and
   * a `<Redirect>` re-issues its navigation each time it renders — which the router
   * turns into an update loop that React eventually kills. Keying the effect on the
   * resolved route means navigation happens once per real destination change,
   * however much the state underneath churns.
   */
  useEffect(() => {
    if (route !== null && route !== '/(auth)') {
      router.replace(route);
    }
  }, [route]);

  /**
   * Signing in is rendered here rather than navigated to.
   *
   * A separate auth route needs something to send the player back once the session
   * arrives, and that second opinion is the other half of the same loop — the gate
   * is not mounted while an auth route is, so each side keeps handing off to the
   * other. Rendering in place keeps `routeForApp` the only authority.
   */
  if (route === '/(auth)') {
    return <AuthScreen />;
  }

  return <LoadingScreen />;
}
