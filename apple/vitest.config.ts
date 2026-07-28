import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Mirrors the `paths` aliases in tsconfig.json so tests and app code can use the
 * same `@/` imports. The asset alias is listed first because `@/assets/*` must not
 * be swallowed by the broader `@/*` rule.
 */
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/assets\/(.*)$/,
        replacement: `${fileURLToPath(new URL('./assets/', import.meta.url))}$1`,
      },
      {
        find: /^@\/(.*)$/,
        replacement: `${fileURLToPath(new URL('./src/', import.meta.url))}$1`,
      },
    ],
  },
});
