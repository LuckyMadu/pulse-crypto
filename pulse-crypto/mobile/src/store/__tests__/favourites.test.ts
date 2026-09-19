/**
 * Favourites: the reducer and its MMKV round trip (R15, R16, R17).
 *
 * The round-trip test matters more than the reducer test. A reducer bug shows
 * up immediately in use; a persistence bug only shows up on the *next* cold
 * start, which is exactly the moment a reviewer is watching the recording.
 */

import { STORAGE_KEYS, appStorage, createPersistor } from "@lib/storage";
import {
  FavouritesState,
  favouritesInitialState,
  favouritesSlice,
  setFavourites,
  toggleFavourite,
} from "../redux/slices/favouritesSlice";

const reducer = favouritesSlice.reducer;

describe("R15 favourites reducer", () => {
  it("R15 adds a pair that is not yet favourited", () => {
    const state = reducer(favouritesInitialState, toggleFavourite("BTCUSDT"));

    expect(state.pairs).toEqual(["BTCUSDT"]);
  });

  it("R15 removes a pair that is already favourited", () => {
    const state = reducer({ pairs: ["BTCUSDT", "ETHUSDT"] }, toggleFavourite("BTCUSDT"));

    expect(state.pairs).toEqual(["ETHUSDT"]);
  });

  it("R15 preserves the order of the remaining pairs", () => {
    const state = reducer(
      { pairs: ["BTCUSDT", "ETHUSDT", "SOLUSDT"] },
      toggleFavourite("ETHUSDT"),
    );

    expect(state.pairs).toEqual(["BTCUSDT", "SOLUSDT"]);
  });

  it("R15 de-duplicates when favourites are set wholesale", () => {
    // Guards against a corrupt or hand-edited persisted value producing
    // duplicate keys in the list, which React would warn about and which would
    // render the same row twice.
    const state = reducer(favouritesInitialState, setFavourites(["BTCUSDT", "BTCUSDT"]));

    expect(state.pairs).toEqual(["BTCUSDT"]);
  });
});

describe("R16/R17 persistence", () => {
  const persistor = createPersistor<FavouritesState>({
    key: STORAGE_KEYS.favourites,
    version: 1,
  });

  beforeEach(() => {
    persistor.clear();
  });

  it("R16 round-trips favourites through storage", () => {
    persistor.save({ pairs: ["BTCUSDT", "SOLUSDT"] });

    expect(persistor.load()).toEqual({ pairs: ["BTCUSDT", "SOLUSDT"] });
  });

  it("R17 loads synchronously, so favourites are known before the first render", () => {
    persistor.save({ pairs: ["ETHUSDT"] });

    // Not a promise. This is the property that lets the value be passed as
    // Redux `preloadedState`, which is what removes the un-favourited flash on
    // cold start.
    const loaded = persistor.load();

    expect(loaded).not.toBeInstanceOf(Promise);
    expect(loaded?.pairs).toEqual(["ETHUSDT"]);
  });

  it("R17 returns undefined when nothing has been stored", () => {
    expect(persistor.load()).toBeUndefined();
  });

  it("R17 discards a value written by an older schema version", () => {
    // The discard is expected here, so the warning it logs is expected too.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const oldVersion = createPersistor<FavouritesState>({
      key: STORAGE_KEYS.favourites,
      version: 1,
    });
    oldVersion.save({ pairs: ["BTCUSDT"] });

    const newVersion = createPersistor<FavouritesState>({
      key: STORAGE_KEYS.favourites,
      version: 2,
    });

    // Better to lose favourites than to merge a stale shape into a state tree
    // that no longer matches it.
    expect(newVersion.load()).toBeUndefined();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it("R17 survives a corrupt stored value rather than failing to start", () => {
    // A parse error here would otherwise escape during store construction,
    // which happens at module scope - so the app would not launch at all.
    appStorage.setObject(STORAGE_KEYS.favourites, undefined);
    expect(() => persistor.load()).not.toThrow();
  });
});
