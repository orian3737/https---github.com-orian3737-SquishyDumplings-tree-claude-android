/**
 * Who is signed in, as a state machine rather than a bag of booleans.
 *
 * The session gate has to choose exactly one destination, and `loading` has to be
 * distinguishable from `signed-out` or the app flashes the sign-in screen at every
 * cold start while the stored session is still being read.
 */
export type AuthState =
  /** The stored session has not been read yet. Show the branded loading state. */
  | Readonly<{ status: 'loading' }>
  /** No session. Route to sign-in. */
  | Readonly<{ status: 'signed-out' }>
  /** A valid session. `userId` owns every row this device may touch. */
  | Readonly<{ status: 'signed-in'; userId: string; email: string | null }>;

export const LOADING_AUTH: AuthState = { status: 'loading' };
export const SIGNED_OUT: AuthState = { status: 'signed-out' };

export function isSignedIn(
  state: AuthState,
): state is Extract<AuthState, { status: 'signed-in' }> {
  return state.status === 'signed-in';
}

/** The owner id for the current session, or null when there is not one. */
export function currentUserId(state: AuthState): string | null {
  return isSignedIn(state) ? state.userId : null;
}

export type AuthFailure = Readonly<{
  /**
   * A message safe to put in front of a player.
   *
   * Auth errors are the one place a raw backend string is most likely to reach the
   * screen, and they are also where the backend is least careful about wording.
   */
  message: string;
  /** True when retrying the identical input might work — network, not credentials. */
  retryable: boolean;
}>;

const FRIENDLY_MESSAGES: Readonly<Record<string, string>> = {
  invalid_credentials: 'That email and password do not match an account.',
  email_exists: 'An account already uses that email. Try signing in instead.',
  user_already_exists:
    'An account already uses that email. Try signing in instead.',
  weak_password: 'Pick a longer password — at least 8 characters.',
  over_email_send_rate_limit:
    'Too many attempts just now. Wait a minute and try again.',
  validation_failed: 'Check the email address and try again.',
};

/**
 * Turns a Supabase auth error into something a player can act on.
 *
 * Matching on `code` rather than on message text: the messages are not a stable
 * API and several of them name internals ("AuthApiError", "grant_type") that mean
 * nothing to a player and look like a crash.
 */
export function describeAuthError(error: {
  code?: string;
  message?: string;
  status?: number;
}): AuthFailure {
  const known =
    error.code === undefined ? undefined : FRIENDLY_MESSAGES[error.code];
  if (known !== undefined) {
    return { message: known, retryable: false };
  }

  // No status at all is the signature of a request that never left the device.
  if (error.status === undefined || error.status === 0) {
    return {
      message: 'Could not reach the server. Check your connection.',
      retryable: true,
    };
  }

  if (error.status >= 500) {
    return {
      message: 'The server had a problem. Try again in a moment.',
      retryable: true,
    };
  }

  return {
    message: error.message ?? 'Something went wrong. Try again.',
    retryable: false,
  };
}

export const MIN_PASSWORD_LENGTH = 8;

export type CredentialProblem = 'email' | 'password' | null;

/**
 * Client-side credential check.
 *
 * Deliberately shallow on email — anything past "looks like an address" belongs to
 * the server, and an over-strict local regex rejects valid addresses. The password
 * floor is ours and is stricter than the Supabase default of 6.
 */
export function credentialProblem(
  email: string,
  password: string,
): CredentialProblem {
  const trimmed = email.trim();
  if (trimmed.length < 3 || !trimmed.includes('@') || trimmed.includes(' ')) {
    return 'email';
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return 'password';
  }

  return null;
}
