import Storage from 'expo-sqlite/kv-store';

import type { KeyValueStore } from './key-value-store';

/**
 * The only file that touches the native storage module.
 *
 * `expo-sqlite/kv-store` is SQLite-backed with an AsyncStorage-compatible API. It
 * ships inside Expo Go, so no development build is needed, and it is the same
 * store PR 4's care-event queue can use without introducing a second one.
 *
 * Import this from app code only. Tests use `createInMemoryKeyValueStore`.
 */
export const expoKeyValueStore: KeyValueStore = {
  getItem: (key) => Storage.getItem(key),
  setItem: (key, value) => Storage.setItem(key, value),
  removeItem: (key) => Storage.removeItem(key),
};
