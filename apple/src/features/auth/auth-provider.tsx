import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AppSupabaseClient } from '@/services/supabase/client';

import {
  credentialProblem,
  describeAuthError,
  LOADING_AUTH,
  MIN_PASSWORD_LENGTH,
  SIGNED_OUT,
  type AuthFailure,
  type AuthState,
} from './auth-state';

export type AuthOutcome =
  | Readonly<{ outcome: 'signed-in' }>
  /** Sign-up succeeded but the project requires the address to be confirmed. */
  | Readonly<{ outcome: 'confirmation-required'; email: string }>
  | Readonly<{ outcome: 'invalid'; field: 'email' | 'password' }>
  | Readonly<{ outcome: 'failed'; failure: AuthFailure }>;

type AuthContextValue = Readonly<{
  state: AuthState;
  signUp(input: { email: string; password: string }): Promise<AuthOutcome>;
  signIn(input: { email: string; password: string }): Promise<AuthOutcome>;
  signOut(): Promise<void>;
}>;

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session lifecycle, driven by `onAuthStateChange`.
 *
 * The listener is the single source of truth rather than the return value of each
 * call. Sign-in, sign-out, a token refresh, and a session restored from storage on
 * cold start all arrive through the same channel, so state cannot diverge depending
 * on which of them happened — and a refresh failure signs the app out without any
 * screen having to notice.
 *
 * The client is injected so the provider can be exercised against a fake.
 */
export function AuthProvider({
  client,
  children,
}: {
  client: AppSupabaseClient;
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>(LOADING_AUTH);

  useEffect(() => {
    let active = true;

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }

      setState(
        session === null
          ? SIGNED_OUT
          : {
              status: 'signed-in',
              userId: session.user.id,
              email: session.user.email ?? null,
            },
      );
    });

    // `onAuthStateChange` fires INITIAL_SESSION on subscribe, which resolves the
    // loading state on its own. This only covers a client that somehow does not.
    void client.auth.getSession().then(({ data: current }) => {
      if (!active) {
        return;
      }

      setState((existing) =>
        existing.status !== 'loading'
          ? existing
          : current.session === null
            ? SIGNED_OUT
            : {
                status: 'signed-in',
                userId: current.session.user.id,
                email: current.session.user.email ?? null,
              },
      );
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const signUp = useCallback(
    async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }): Promise<AuthOutcome> => {
      const problem = credentialProblem(email, password);
      if (problem !== null) {
        return { outcome: 'invalid', field: problem };
      }

      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error !== null) {
        return { outcome: 'failed', failure: describeAuthError(error) };
      }

      /**
       * A project with email confirmation on returns a user and no session. The
       * player is not signed in yet and telling them otherwise would strand them
       * on a loading screen, so this is a distinct outcome rather than a success.
       */
      if (data.session === null) {
        return { outcome: 'confirmation-required', email: email.trim() };
      }

      return { outcome: 'signed-in' };
    },
    [client],
  );

  const signIn = useCallback(
    async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }): Promise<AuthOutcome> => {
      // Only the shape is checked here. A short stored password from an older
      // policy must still be able to sign in, so the length floor is not applied.
      if (!email.includes('@') || password.length === 0) {
        return {
          outcome: 'invalid',
          field: email.includes('@') ? 'password' : 'email',
        };
      }

      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error !== null) {
        return { outcome: 'failed', failure: describeAuthError(error) };
      }

      return { outcome: 'signed-in' };
    },
    [client],
  );

  const signOut = useCallback(async () => {
    await client.auth.signOut();
    // The listener will report signed-out. Setting it here too means a failed
    // network sign-out still clears the UI, which is what the player asked for.
    setState(SIGNED_OUT);
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signUp, signIn, signOut }),
    [state, signUp, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }

  return value;
}

export { MIN_PASSWORD_LENGTH };
