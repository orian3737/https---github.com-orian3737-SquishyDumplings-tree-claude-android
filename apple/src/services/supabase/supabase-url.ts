/**
 * The project URL, not a service endpoint under it.
 *
 * `supabase-js` appends `/auth/v1`, `/rest/v1`, and the rest itself, so a URL that
 * already ends in one of those produces requests to `…/rest/v1/auth/v1/signup`.
 * Those fail without an HTTP status, which surfaces to the player as "could not
 * reach the server" — a network problem that is not a network problem, on a
 * configuration mistake that is easy to make because the dashboard displays the
 * REST endpoint prominently. This cost a debugging session once already.
 *
 * Its own module, free of any native import, so it can be tested in Node. The
 * client itself pulls in `react-native` for AppState and is therefore not
 * loadable in the test runner — the same reason the domain layer keeps platform
 * modules behind a port.
 */
export function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');

  // Only a TRAILING service segment is the mistake. A longer path is someone's
  // deliberate proxy and stripping it would break them.
  const withoutService = trimmed.replace(
    /\/(auth|rest|realtime|storage|functions)\/v\d+$/,
    '',
  );

  if (withoutService.length === 0) {
    throw new Error(
      `EXPO_PUBLIC_SUPABASE_URL is not a usable project URL: ${raw}`,
    );
  }

  return withoutService;
}
