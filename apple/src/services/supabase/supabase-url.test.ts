import { describe, expect, it } from 'vitest';

import { normalizeSupabaseUrl } from './supabase-url';

/**
 * These exist because the wrong value cost a debugging session.
 *
 * The dashboard shows the REST endpoint prominently, so pasting
 * `https://<ref>.supabase.co/rest/v1/` into the env is an easy mistake — and it
 * fails as a phantom network error rather than a configuration one, because
 * `supabase-js` appends its own service path and the resulting URL simply does not
 * answer.
 */
describe('normalizeSupabaseUrl', () => {
  const project = 'https://wnfprwzgghowwkvibihs.supabase.co';

  it('leaves a correct project URL alone', () => {
    expect(normalizeSupabaseUrl(project)).toBe(project);
  });

  it('strips the REST endpoint that the dashboard displays', () => {
    expect(normalizeSupabaseUrl(`${project}/rest/v1/`)).toBe(project);
    expect(normalizeSupabaseUrl(`${project}/rest/v1`)).toBe(project);
  });

  it.each(['auth', 'realtime', 'storage', 'functions'])(
    'strips a /%s/v1 endpoint too',
    (service) => {
      expect(normalizeSupabaseUrl(`${project}/${service}/v1`)).toBe(project);
    },
  );

  it('strips trailing slashes, which would double up on every request path', () => {
    expect(normalizeSupabaseUrl(`${project}///`)).toBe(project);
  });

  it('trims surrounding whitespace from a pasted value', () => {
    expect(normalizeSupabaseUrl(`  ${project}/rest/v1/  `)).toBe(project);
  });

  it('leaves a local development URL and its port intact', () => {
    expect(normalizeSupabaseUrl('http://127.0.0.1:54421')).toBe(
      'http://127.0.0.1:54421',
    );
  });

  it('does not strip a path that merely looks like a service', () => {
    // Only a trailing service segment is a mistake; anything else is someone's
    // deliberate proxy path and removing it would break them.
    expect(normalizeSupabaseUrl(`${project}/rest/v1/pets`)).toBe(
      `${project}/rest/v1/pets`,
    );
  });

  it('refuses a value that normalizes away to nothing', () => {
    expect(() => normalizeSupabaseUrl('/rest/v1')).toThrow(
      /not a usable project URL/,
    );
  });
});
