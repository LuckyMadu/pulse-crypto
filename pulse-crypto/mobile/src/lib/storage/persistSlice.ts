/**
 * A minimal synchronous Redux persistence layer over MMKV.
 *
 * Why not `redux-persist`? MMKV is synchronous, so the whole async rehydration
 * apparatus - `PersistGate`, `REHYDRATE` actions, a loading state on cold
 * start - solves a problem this app does not have. Reading on store init and
 * passing `preloadedState` is both simpler and strictly better UX (R17).
 *
 * The versioned envelope is the part worth keeping from the library: a stored
 * shape from an older build is discarded rather than merged into a state tree
 * that no longer matches it.
 */

import { Middleware } from "@reduxjs/toolkit";
import { logger } from "@utils";
import { appStorage } from "./storage";

interface Envelope<TPicked> {
  v: number;
  data: TPicked;
}

export interface SlicePersistor<TPicked> {
  load: () => TPicked | undefined;
  save: (value: TPicked) => void;
  clear: () => void;
}

export const createPersistor = <TPicked>({
  key,
  version,
  storage = appStorage,
}: {
  key: string;
  version: number;
  storage?: typeof appStorage;
}): SlicePersistor<TPicked> => ({
  load: () => {
    const envelope = storage.getObject<Envelope<TPicked>>(key);
    if (!envelope) return undefined;

    if (envelope.v !== version) {
      logger.warn(
        `[persist] version mismatch for "${key}" (stored=${envelope.v}, expected=${version}); discarding`,
      );
      storage.remove(key);
      return undefined;
    }
    return envelope.data;
  },
  save: value => storage.setObject<Envelope<TPicked>>(key, { v: version, data: value }),
  clear: () => storage.remove(key),
});

export interface SlicePersistConfig<TSliceState, TPicked> {
  /** Top-level key in the root state, e.g. `"favourites"`. */
  slice: string;
  persistor: SlicePersistor<TPicked>;
  /** Project the persistable subset out of the slice. */
  pick: (state: TSliceState) => TPicked;
}

const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every(key =>
    Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
};

/**
 * Mirror configured slices to MMKV whenever their persisted projection changes.
 *
 * The equality check is what keeps this off the hot path: the middleware runs
 * on every dispatch, but it only writes when the *picked* projection actually
 * changed. Since tick data never goes through Redux, that is rare by
 * construction - but the guard means the design does not depend on that
 * remaining true.
 */
export const createPersistMiddleware = <TRootState>(
  // Each config is type-checked at its call site; the loop below treats them
  // uniformly, which needs the widened signature.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configs: ReadonlyArray<SlicePersistConfig<any, any>>,
): Middleware<Record<string, never>, TRootState> => {
  const opaque = configs as ReadonlyArray<SlicePersistConfig<unknown, unknown>>;
  const lastSaved = new Map<string, unknown>();

  // Seed from disk so the first dispatch does not rewrite what was just read.
  for (const cfg of opaque) lastSaved.set(cfg.slice, cfg.persistor.load());

  return store => next => action => {
    const result = next(action);
    const state = store.getState() as Record<string, unknown>;

    for (const cfg of opaque) {
      const sliceState = state[cfg.slice];
      if (sliceState === undefined) continue;

      const nextPicked = cfg.pick(sliceState);
      if (!shallowEqual(lastSaved.get(cfg.slice), nextPicked)) {
        cfg.persistor.save(nextPicked);
        lastSaved.set(cfg.slice, nextPicked);
      }
    }

    return result;
  };
};
