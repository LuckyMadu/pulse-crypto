/**
 * Typed Redux hooks, so no call site has to restate `RootState`.
 */

import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "./redux";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/** Favourite pairs, sorted to the top of the watchlist (R15). */
export const useFavourites = (): string[] =>
  useAppSelector(state => state.favourites.pairs);

export const useIsFavourite = (pair: string): boolean =>
  useAppSelector(state => state.favourites.pairs.includes(pair));
