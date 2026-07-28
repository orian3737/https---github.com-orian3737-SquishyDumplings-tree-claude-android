import type { Pet } from '@/domain';
import type { PetLoadOutcome } from '@/services/pet/pet-repository';

/**
 * Where the app should be for the current session.
 *
 * FR-1 requires every state to have a deterministic next route and no blank or
 * flashing screen, so this is a pure function of the load outcome rather than
 * something each screen guesses at.
 */
export type SessionState =
  /** Local state has not been read yet. Show the branded loading state. */
  | Readonly<{ status: 'loading' }>
  /** No dumpling has ever been hatched. Route to onboarding. */
  | Readonly<{ status: 'needs-onboarding' }>
  /** A dumpling exists. Route to the habitat. */
  | Readonly<{ status: 'ready'; pet: Pet }>
  /**
   * Cached state exists but could not be read. Route to a recoverable error, never
   * to onboarding: offering a fresh hatch here would replace the dumpling the
   * player already has.
   */
  | Readonly<{ status: 'unreadable'; error: string }>;

export function sessionStateFrom(outcome: PetLoadOutcome): SessionState {
  switch (outcome.status) {
    case 'empty':
      return { status: 'needs-onboarding' };
    case 'loaded':
      return { status: 'ready', pet: outcome.pet };
    case 'corrupt':
      return { status: 'unreadable', error: outcome.error };
  }
}

export const LOADING_SESSION: SessionState = { status: 'loading' };

/** The route each session state resolves to. Exhaustive by construction. */
export type SessionRoute = '/(onboarding)' | '/habitat' | '/unreadable';

/**
 * Where to send the player, or null while local state is still being read.
 *
 * Null means "stay put and show the loading state" rather than "no destination",
 * which is what keeps the gate from redirecting to a half-known place and flashing.
 */
export function routeForSession(state: SessionState): SessionRoute | null {
  switch (state.status) {
    case 'loading':
      return null;
    case 'needs-onboarding':
      return '/(onboarding)';
    case 'ready':
      return '/habitat';
    case 'unreadable':
      return '/unreadable';
  }
}

/** True when the player may hatch. Only ever true with no dumpling present. */
export function canHatch(state: SessionState): boolean {
  return state.status === 'needs-onboarding';
}
