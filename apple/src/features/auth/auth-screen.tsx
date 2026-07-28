import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInput as TextInputRef,
} from 'react-native';

import { colors } from '@/theme/colors';

import { MIN_PASSWORD_LENGTH, useAuth } from './auth-provider';
/**
 * Sign in, or make an account.
 *
 * One screen with a mode toggle rather than two routes. The fields are identical,
 * and a player who taps the wrong one should not lose what they have typed —
 * which is exactly what navigating between two screens would do.
 *
 * Email and password because it is the least that can go wrong and it carries to
 * Android unchanged. Sign in with Apple can join it later without this screen
 * changing shape.
 */
type Mode = 'sign-in' | 'sign-up';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const passwordRef = useRef<TextInputRef>(null);

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    const result =
      mode === 'sign-up'
        ? await signUp({ email, password })
        : await signIn({ email, password });

    switch (result.outcome) {
      case 'signed-in':
        // The gate redirects off this screen once the provider reports the
        // session, so there is nothing to navigate to here.
        break;
      case 'confirmation-required':
        setNotice(
          `Check ${result.email} for a confirmation link, then sign in.`,
        );
        break;
      case 'invalid':
        setError(
          result.field === 'email'
            ? 'That does not look like an email address.'
            : `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`,
        );
        break;
      case 'failed':
        setError(result.failure.message);
        break;
    }

    setBusy(false);
  }, [busy, email, mode, password, signIn, signUp]);

  const isSignUp = mode === 'sign-up';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ backgroundColor: colors.cream, flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          gap: 18,
          justifyContent: 'center',
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text
            style={{ fontSize: 15, fontWeight: '800', color: colors.muted }}
          >
            SQUISHY DUMPLINGS
          </Text>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.ink }}>
            {isSignUp ? 'Make an account' : 'Welcome back'}
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            {isSignUp
              ? 'Your dumpling is kept safe against your account, so it survives a new phone.'
              : 'Sign in and your dumpling picks up where you left it.'}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Field
            autoComplete="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="you@example.com"
            returnKeyType="next"
            value={email}
          />

          <Field
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            inputRef={passwordRef}
            label="Password"
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            placeholder={
              isSignUp
                ? `At least ${MIN_PASSWORD_LENGTH} characters`
                : 'Password'
            }
            returnKeyType="go"
            secureTextEntry
            value={password}
          />
        </View>

        {error !== null ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.danger, fontWeight: '700' }}
          >
            {error}
          </Text>
        ) : null}

        {notice !== null ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.ink, fontWeight: '700' }}
          >
            {notice}
          </Text>
        ) : null}

        <Pressable
          accessibilityLabel={isSignUp ? 'Create account' : 'Sign in'}
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPress={() => void submit()}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: busy
              ? '#e3cdb4'
              : pressed
                ? '#e0a52f'
                : colors.amberDeep,
            borderRadius: 16,
            justifyContent: 'center',
            minHeight: 52,
          })}
        >
          {busy ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text
              style={{ color: colors.ink, fontSize: 17, fontWeight: '900' }}
            >
              {isSignUp ? 'Create account' : 'Sign in'}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityLabel={
            isSignUp
              ? 'I already have an account. Switch to sign in.'
              : 'I need an account. Switch to sign up.'
          }
          accessibilityRole="button"
          onPress={() => {
            // Keep what they typed: the fields are the same either way, and a
            // mistaken tap should not cost them the password they just entered.
            setMode(isSignUp ? 'sign-in' : 'sign-up');
            setError(null);
            setNotice(null);
          }}
          style={{
            alignItems: 'center',
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.muted, fontWeight: '700' }}>
            {isSignUp
              ? 'I already have an account'
              : 'I need to make an account'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  autoComplete,
  inputRef,
  keyboardType,
  label,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  secureTextEntry,
  value,
}: {
  autoComplete: 'email' | 'new-password' | 'current-password';
  inputRef?: React.RefObject<TextInputRef | null>;
  keyboardType?: 'email-address';
  label: string;
  onChangeText: (next: string) => void;
  onSubmitEditing: () => void;
  placeholder: string;
  returnKeyType: 'next' | 'go';
  secureTextEntry?: boolean;
  value: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.ink, fontWeight: '800' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoComplete={autoComplete}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor="#b3a294"
        ref={inputRef}
        returnKeyType={returnKeyType}
        secureTextEntry={secureTextEntry}
        style={{
          backgroundColor: colors.paper,
          borderColor: '#ead9cc',
          borderRadius: 14,
          borderWidth: 1,
          color: colors.ink,
          fontSize: 17,
          minHeight: 52,
          paddingHorizontal: 14,
        }}
        value={value}
      />
    </View>
  );
}
