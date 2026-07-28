import { describe, expect, it } from 'vitest';

import { createTestPet } from '@/domain/__fixtures__/pet';

import {
  canHatch,
  routeForSession,
  sessionStateFrom,
  type SessionState,
} from './session-state';

describe('sessionStateFrom', () => {
  it('sends a brand-new install to onboarding', () => {
    expect(sessionStateFrom({ status: 'empty' })).toEqual({
      status: 'needs-onboarding',
    });
  });

  it('sends an established install to the habitat with its pet', () => {
    const pet = createTestPet();

    expect(
      sessionStateFrom({ status: 'loaded', pet, repaired: false }),
    ).toEqual({
      status: 'ready',
      pet,
    });
  });

  it('carries a repaired pet through unchanged', () => {
    const pet = createTestPet();

    expect(sessionStateFrom({ status: 'loaded', pet, repaired: true })).toEqual(
      {
        status: 'ready',
        pet,
      },
    );
  });

  it('routes unreadable state to an error, never to onboarding', () => {
    const state = sessionStateFrom({ status: 'corrupt', error: 'bad json' });

    expect(state.status).toBe('unreadable');
    expect(canHatch(state)).toBe(false);
  });
});

describe('canHatch', () => {
  const pet = createTestPet();

  it.each([
    [{ status: 'loading' } as SessionState, false],
    [{ status: 'needs-onboarding' } as SessionState, true],
    [{ status: 'ready', pet } as SessionState, false],
    [{ status: 'unreadable', error: 'x' } as SessionState, false],
  ])('case %# allows hatching: %s', (state, expected) => {
    expect(canHatch(state)).toBe(expected);
  });
});

describe('routeForSession', () => {
  const pet = createTestPet();

  it.each([
    [{ status: 'needs-onboarding' } as SessionState, '/(onboarding)'],
    [{ status: 'ready', pet } as SessionState, '/habitat'],
    [{ status: 'unreadable', error: 'x' } as SessionState, '/unreadable'],
  ])('case %# routes to %s', (state, expected) => {
    expect(routeForSession(state)).toBe(expected);
  });

  it('holds still while loading rather than redirecting somewhere half-known', () => {
    expect(routeForSession({ status: 'loading' })).toBeNull();
  });

  it('gives every settled state a real destination, so nothing lands on a blank screen', () => {
    const settled: SessionState[] = [
      { status: 'needs-onboarding' },
      { status: 'ready', pet },
      { status: 'unreadable', error: 'x' },
    ];

    for (const state of settled) {
      expect(routeForSession(state)?.length).toBeGreaterThan(0);
    }
  });
});
