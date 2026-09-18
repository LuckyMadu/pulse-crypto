/* eslint-disable no-undef */

/**
 * Jest setup.
 *
 * Only native modules are mocked here. The units under test - the market
 * store, the favourites reducer, the metadata normalizer - are deliberately
 * plain TypeScript with no React Native dependency, which is what makes them
 * testable without a renderer at all. The mocks below exist so that *importing*
 * a module that happens to touch MMKV does not fail.
 */

// MMKV is a native module (Nitro), so there is nothing to call in a Node test
// environment. An in-memory Map has identical semantics for our purposes:
// synchronous get/set/remove of strings.
jest.mock("react-native-mmkv", () => {
  const stores = new Map();

  return {
    createMMKV: ({ id }) => {
      if (!stores.has(id)) stores.set(id, new Map());
      const store = stores.get(id);

      return {
        set: (key, value) => store.set(key, value),
        getString: key => store.get(key),
        remove: key => store.delete(key),
        clearAll: () => store.clear(),
        contains: key => store.has(key),
      };
    },
  };
});

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Reanimated ships its own Jest mock; without it, shared values throw outside
// a worklet runtime.
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);
