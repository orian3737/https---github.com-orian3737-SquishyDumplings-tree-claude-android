import { describe, expect, it } from 'vitest';

import { createTestPet } from '@/domain/__fixtures__/pet';
import {
  LOADING_AUTH,
  SIGNED_OUT,
  type AuthState,
} from '@/features/auth/auth-state';

import { routeForApp, shouldClearLocalCache } from './app-route';
import { LOADING_SESSION, type SessionState } from './session-state';

const signedIn = (userId = 'user-1'): AuthState => ({
  status: 'signed-in',
  userId,
  email: 'player@example.test',
});

const ready: SessionState = { status: 'ready', pet: createTestPet() };
const needsOnboarding: SessionState = { status: 'needs-onboarding' };
const unreadable: SessionState = { status: 'unreadable', error: 'bad json' };

describe('routeForApp', () => {
  it('stays put while auth is still loading, whatever the session says', () => {
    // Resolving here would show sign-in for a frame on every cold launch.
    for (const session of [
      LOADING_SESSION,
      ready,
      needsOnboarding,
      unreadable,
    ]) {
      expect(routeForApp(LOADING_AUTH, session)).toBeNull();
    }
  });

  it('sends a signed-out player to auth, whatever the session says', () => {
    for (const session of [
      LOADING_SESSION,
      ready,
      needsOnboarding,
      unreadable,
    ]) {
      expect(routeForApp(SIGNED_OUT, session)).toBe('/(auth)');
    }
  });

  it('stays put while a signed-in player’s local state is still loading', () => {
    expect(routeForApp(signedIn(), LOADING_SESSION)).toBeNull();
  });

  it('defers to the session resolver once signed in', () => {
    expect(routeForApp(signedIn(), ready)).toBe('/habitat');
    expect(routeForApp(signedIn(), needsOnboarding)).toBe('/(onboarding)');
    expect(routeForApp(signedIn(), unreadable)).toBe('/unreadable');
  });

  it('never sends a corrupt cache to onboarding', () => {
    // Offering a fresh hatch here would replace a dumpling the player still has.
    expect(routeForApp(signedIn(), unreadable)).not.toBe('/(onboarding)');
  });
});

describe('shouldClearLocalCache', () => {
  it('clears on sign-out', () => {
    expect(shouldClearLocalCache(signedIn(), SIGNED_OUT)).toBe(true);
  });

  it('clears when a different person signs in on the same device', () => {
    expect(shouldClearLocalCache(signedIn('a'), signedIn('b'))).toBe(true);
  });

  it('does not clear on a token refresh for the same person', () => {
    // Refreshes re-emit signed-in constantly. Clearing here would wipe the cache
    // roughly every hour.
    expect(shouldClearLocalCache(signedIn('a'), signedIn('a'))).toBe(false);
  });

  it('does not clear while auth is still resolving', () => {
    expect(shouldClearLocalCache(LOADING_AUTH, SIGNED_OUT)).toBe(false);
    expect(shouldClearLocalCache(LOADING_AUTH, signedIn())).toBe(false);
    expect(shouldClearLocalCache(SIGNED_OUT, LOADING_AUTH)).toBe(false);
  });

  it('does not clear on a normal first sign-in', () => {
    expect(shouldClearLocalCache(SIGNED_OUT, signedIn())).toBe(false);
  });
});
