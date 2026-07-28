/**
 * The storage boundary.
 *
 * Everything above this port is platform-neutral and unit-testable in Node. Only
 * `expo-kv-store.ts` imports the native module, so tests never need a simulator or
 * a mocked Expo runtime.
 *
 * The shape matches the AsyncStorage-style API that `expo-sqlite/kv-store`
 * provides, which keeps the adapter a one-liner.
 */
export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type InMemoryKeyValueStore = KeyValueStore & {
  /** Current contents, for assertions about what was actually written. */
  snapshot(): Readonly<Record<string, string>>;
};

/** For tests and for any prototype that should not outlive the process. */
export function createInMemoryKeyValueStore(
  seed: Readonly<Record<string, string>> = {},
): InMemoryKeyValueStore {
  const entries = new Map<string, string>(Object.entries(seed));

  return {
    getItem: async (key) => entries.get(key) ?? null,
    setItem: async (key, value) => {
      entries.set(key, value);
    },
    removeItem: async (key) => {
      entries.delete(key);
    },
    snapshot: () => Object.fromEntries(entries),
  };
}
