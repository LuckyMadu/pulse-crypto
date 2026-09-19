/**
 * MMKV instance and a small typed wrapper.
 *
 * MMKV rather than AsyncStorage for one property that matters here: it is
 * **synchronous**. Favourites can therefore be read during store construction
 * and passed as `preloadedState`, so the first frame already has them (R17).
 * With an async store the app must render once without favourites and then
 * again with them, which is a visible flash of the wrong state on every cold
 * start - and the usual fix, a `PersistGate`, trades that flash for a splash
 * screen instead of removing it.
 */

import { createMMKV } from "react-native-mmkv";
import { logger } from "@utils";

export const APP_STORAGE_ID = "pulsecrypto.app";

const mmkv = createMMKV({ id: APP_STORAGE_ID });

export const appStorage = {
  getObject<T>(key: string): T | undefined {
    const raw = mmkv.getString(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt entry: drop it rather than letting a parse error escape into
      // store construction, which would prevent the app from starting at all.
      logger.warn(`[storage] discarding corrupt value at "${key}"`);
      mmkv.remove(key);
      return undefined;
    }
  },

  setObject<T>(key: string, value: T): void {
    mmkv.set(key, JSON.stringify(value));
  },

  remove(key: string): void {
    mmkv.remove(key);
  },
};

export const STORAGE_KEYS = {
  favourites: "favourites.state",
} as const;
