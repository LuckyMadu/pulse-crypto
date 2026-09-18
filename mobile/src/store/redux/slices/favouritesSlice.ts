/**
 * Favourite pairs (R15, R16, R17).
 *
 * This is the state that *should* be in Redux, and contrasting it with the
 * tick data that should not is the clearest way to explain the three-tier
 * model: favourites change when a human taps something - a few times a session
 * - and must outlive the process. Prices change 50 times a second and are
 * worthless once superseded. Same app, opposite requirements, so different
 * tools.
 *
 * Stored as an array rather than a `Set` because Redux state must be
 * serialisable, and as an array rather than a `Record<string, boolean>` because
 * insertion order is meaningful if favourite ordering is ever surfaced.
 */

import { PayloadAction, createSlice } from "@reduxjs/toolkit";

export interface FavouritesState {
  pairs: string[];
}

export const favouritesInitialState: FavouritesState = { pairs: [] };

export const favouritesSlice = createSlice({
  name: "favourites",
  initialState: favouritesInitialState,
  reducers: {
    toggleFavourite: (state, action: PayloadAction<string>) => {
      const index = state.pairs.indexOf(action.payload);
      if (index >= 0) state.pairs.splice(index, 1);
      else state.pairs.push(action.payload);
    },
    setFavourites: (state, action: PayloadAction<string[]>) => {
      // De-duplicate on the way in so a corrupt or hand-edited persisted value
      // cannot produce duplicate keys in the list.
      state.pairs = [...new Set(action.payload)];
    },
    clearFavourites: state => {
      state.pairs = [];
    },
  },
});

export const { toggleFavourite, setFavourites, clearFavourites } = favouritesSlice.actions;
