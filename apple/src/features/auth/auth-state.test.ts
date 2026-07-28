import { describe, expect, it } from 'vitest';

import {
  credentialProblem,
  currentUserId,
  describeAuthError,
  isSignedIn,
  LOADING_AUTH,
  MIN_PASSWORD_LENGTH,
  SIGNED_OUT,
  type AuthState,
} from './auth-state';

const signedIn: AuthState = {
  status: 'signed-in',
  userId: 'user-1',
  email: 'player@example.test',
};

describe('auth state', () => {
  it('keeps loading distinguishable from signed out', () => {
    // The gate routes on this. Collapsing the two flashes the sign-in screen on
    // every cold start while the stored session is still being read.
    expect(LOADING_AUTH.status).toBe('loading');
    expect(SIGNED_OUT.status).toBe('signed-out');
    expect(isSignedIn(LOADING_AUTH)).toBe(false);
    expect(isSignedIn(SIGNED_OUT)).toBe(false);
  });

  it('reports an owner id only when signed in', () => {
    expect(currentUserId(signedIn)).toBe('user-1');
    expect(currentUserId(LOADING_AUTH)).toBeNull();
    expect(currentUserId(SIGNED_OUT)).toBeNull();
  });
});

describe('credentialProblem', () => {
  it('accepts an ordinary address and a long-enough password', () => {
    expect(
      credentialProblem('player@example.test', 'a-good-password'),
    ).toBeNull();
  });

  it.each([
    ['', 'no address at all'],
    ['   ', 'only whitespace'],
    ['player', 'no at sign'],
    ['a b@example.test', 'an embedded space'],
  ])('rejects %j — %s', (email) => {
    expect(credentialProblem(email, 'a-good-password')).toBe('email');
  });

  it('accepts addresses a stricter regex would wrongly refuse', () => {
    // Plus-addressing, subdomains, and long TLDs are all valid, and a local rule
    // that rejects them locks real people out of their own accounts.
    for (const email of [
      'player+dumpling@example.test',
      'p@mail.subdomain.example.museum',
      "o'brien@example.test",
    ]) {
      expect(credentialProblem(email, 'a-good-password')).toBeNull();
    }
  });

  it('enforces the password floor, which is stricter than the Supabase default', () => {
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    const exact = 'x'.repeat(MIN_PASSWORD_LENGTH);

    expect(credentialProblem('player@example.test', short)).toBe('password');
    expect(credentialProblem('player@example.test', exact)).toBeNull();
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThan(6);
  });

  it('reports the email first when both are wrong', () => {
    // One message at a time, and the field the player reads first.
    expect(credentialProblem('nope', 'x')).toBe('email');
  });
});

describe('describeAuthError', () => {
  it('turns known codes into something a player can act on', () => {
    const failure = describeAuthError({
      code: 'invalid_credentials',
      message: 'AuthApiError: invalid grant_type',
      status: 400,
    });

    expect(failure.message).toBe(
      'That email and password do not match an account.',
    );
    expect(failure.retryable).toBe(false);
    // The raw message names internals and must not reach the screen.
    expect(failure.message).not.toContain('grant_type');
  });

  it('points a duplicate signup at signing in instead', () => {
    for (const code of ['email_exists', 'user_already_exists']) {
      expect(describeAuthError({ code, status: 422 }).message).toContain(
        'Try signing in instead',
      );
    }
  });

  it('treats a request that never left the device as retryable', () => {
    const failure = describeAuthError({ message: 'Network request failed' });

    expect(failure.retryable).toBe(true);
    expect(failure.message).toContain('connection');
  });

  it('treats a server fault as retryable and a client fault as not', () => {
    expect(describeAuthError({ status: 503, message: 'nope' }).retryable).toBe(
      true,
    );
    expect(describeAuthError({ status: 400, message: 'nope' }).retryable).toBe(
      false,
    );
  });

  it('falls back to the raw message rather than inventing one', () => {
    // Unknown but specific beats friendly but useless when someone reports a bug.
    expect(
      describeAuthError({
        code: 'something_new',
        status: 418,
        message: 'Teapot',
      }).message,
    ).toBe('Teapot');
  });

  it('always produces a non-empty message', () => {
    expect(describeAuthError({}).message.length).toBeGreaterThan(0);
    expect(describeAuthError({ status: 400 }).message.length).toBeGreaterThan(
      0,
    );
  });
});
