/**
 * The Redux store.
 *
 * What is here and what is deliberately not:
 *
 *  - `api`        - RTK Query cache for `/pairs/meta`. Not persisted; metadata
 *                   is cheap to refetch and stale 24h stats are worse than
 *                   none.
 *  - `favourites` - persisted to MMKV, and hydrated **synchronously** via
 *                   `preloadedState` so R17 holds on the very first frame.
 *  - tick data    - **not here at all.** It lives in
 *                   `src/realtime/marketStore.ts`. See AGENTS.md invariant 1.
 */

import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { STORAGE_KEYS, createPersistMiddleware, createPersistor } from "@lib/storage";
import { api } from "./api/baseApi";
import { FavouritesState, favouritesInitialState, favouritesSlice } from "./slices/favouritesSlice";

// Injects the endpoints onto `api` as a side effect of the import.
import "./api/pairsApi";

const favouritesPersistor = createPersistor<FavouritesState>({
  key: STORAGE_KEYS.favourites,
  version: 1,
});

// Synchronous read at module scope. This is the whole reason MMKV was chosen
// over AsyncStorage: by the time `configureStore` runs, favourites are known,
// so there is no un-favourited first frame to flash (R17).
const preloadedState = {
  favourites: favouritesPersistor.load() ?? favouritesInitialState,
};

const persistMiddleware = createPersistMiddleware([
  {
    slice: "favourites",
    persistor: favouritesPersistor,
    pick: (state: FavouritesState) => state,
  },
]);

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    favourites: favouritesSlice.reducer,
  },
  preloadedState,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(api.middleware, persistMiddleware),
});

// Enables `refetchOnReconnect` / `refetchOnFocus` behaviour.
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
