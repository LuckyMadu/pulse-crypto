/**
 * The bridge from the external store into React.
 *
 * `useSyncExternalStore` is the correct primitive here rather than a
 * `useState` + `useEffect` pairing: it is tear-free under concurrent rendering,
 * and it lets the subscription be scoped to a single key. Each hook below
 * subscribes to exactly the slice its caller reads, which is what makes a BTC
 * tick cost one row re-render instead of a tree walk.
 *
 * Every `subscribe` callback is memoised on its key. Passing a fresh function
 * would make React resubscribe on every render - correct, but it would churn
 * the listener set at 10 Hz.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { config } from "@config";
import { Book, GatewayStats, UpstreamState } from "@protocol";
import { ConnectionStatus, Ticker, marketStore } from "./marketStore";
import { useMarketStream } from "./MarketStreamProvider";

/** One pair's live state (R13, R18). Re-renders only when this pair ticks. */
export const useTicker = (pair: string): Ticker => {
  const subscribe = useCallback(
    (listener: () => void) => marketStore.subscribeTicker(pair, listener),
    [pair],
  );
  const getSnapshot = useCallback(() => marketStore.getTicker(pair), [pair]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

/** One pair's order book (R18). Only the detail screen subscribes. */
export const useOrderBook = (pair: string): Book => {
  const subscribe = useCallback(
    (listener: () => void) => marketStore.subscribeBook(pair, listener),
    [pair],
  );
  const getSnapshot = useCallback(() => marketStore.getBook(pair), [pair]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

const subscribeGlobal = (listener: () => void) => marketStore.subscribeGlobal(listener);

/** Socket status for the app bar and the offline banner (R24). */
export const useConnectionStatus = (): ConnectionStatus =>
  useSyncExternalStore(subscribeGlobal, marketStore.getStatus, marketStore.getStatus);

/** The gateway's own link to Binance, which is a different thing to ours. */
export const useUpstreamState = (): UpstreamState =>
  useSyncExternalStore(subscribeGlobal, marketStore.getUpstream, marketStore.getUpstream);

/** Gateway telemetry, pushed once a second. */
export const useStreamStats = (): GatewayStats | null =>
  useSyncExternalStore(subscribeGlobal, marketStore.getStats, marketStore.getStats);

export const useEmitInterval = (): number =>
  useSyncExternalStore(
    subscribeGlobal,
    marketStore.getEmitIntervalMs,
    marketStore.getEmitIntervalMs,
  );

/** Pair display order, seeded from the server snapshot. */
export const useStreamPairs = (): string[] =>
  useSyncExternalStore(subscribeGlobal, marketStore.getPairs, marketStore.getPairs);

/**
 * Subscribe to order book depth for a pair while this component is mounted
 * (R18), and release it on unmount.
 *
 * Bundling subscribe and unsubscribe into one hook is what stops the app from
 * leaking subscriptions as the user browses pairs - the gateway would
 * otherwise keep serialising books nobody is rendering.
 */
export const useDepthSubscription = (pair: string | null): void => {
  const client = useMarketStream();

  useEffect(() => {
    if (!pair) return;
    client.subscribeDepth([pair]);
    return () => client.subscribeDepth([]);
  }, [client, pair]);
};

/**
 * Whether a pair has ticked recently (R13).
 *
 * This distinguishes "the connection died" from "DOGE just is not trading right
 * now", which is a real and useful distinction in a market viewer and one a
 * global indicator alone cannot express.
 *
 * The staleness check is driven by a 1 Hz timer rather than recomputed on
 * render, because staleness is a function of *elapsed time*, not of renders - a
 * pair that stops ticking also stops triggering renders, so a render-time check
 * would leave its dot green forever.
 */
export const useIsPairLive = (timestamp: number): boolean => {
  const status = useConnectionStatus();
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick(value => value + 1), 1_000);
    return () => clearInterval(interval);
  }, []);

  if (status !== "live") return false;
  if (timestamp <= 0) return false;
  return Date.now() - timestamp < config.ui.stalePairThresholdMs;
};

/**
 * JS-thread frame rate (R20).
 *
 * Measures the **JS thread** specifically, which is the honest metric for this
 * architecture: Reanimated animations run on the UI thread and would keep
 * looking smooth even if JS were saturated, so a UI-thread FPS reading would
 * flatter the design rather than test it. This number is the one that would
 * visibly collapse if tick data went through Redux.
 *
 * `requestAnimationFrame` on the JS thread fires once per display frame, so
 * counting callbacks over a one-second window gives frames per second directly.
 */
export const useJsThreadFps = (): number => {
  const [fps, setFps] = useState(60);
  const frames = useRef(0);
  const windowStart = useRef(Date.now());

  useEffect(() => {
    let handle: number;
    let cancelled = false;

    const loop = () => {
      if (cancelled) return;
      frames.current += 1;

      const now = Date.now();
      const elapsed = now - windowStart.current;
      if (elapsed >= config.ui.fpsSampleWindowMs) {
        setFps(Math.round((frames.current * 1000) / elapsed));
        frames.current = 0;
        windowStart.current = now;
      }

      handle = requestAnimationFrame(loop);
    };

    handle = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  }, []);

  return fps;
};

/**
 * Re-render on an interval, for components whose output is a function of the
 * clock rather than of data - the "updated 3s ago" label being the case here.
 */
export const useClockTick = (intervalMs = 1_000): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
};

/** Sorted pair list with favourites first, memoised on both inputs. */
export const useSortedPairs = (pairs: string[], favourites: string[]): string[] =>
  useMemo(() => {
    const favouriteSet = new Set(favourites);
    return [...pairs].sort((left, right) => {
      const leftFav = favouriteSet.has(left) ? 0 : 1;
      const rightFav = favouriteSet.has(right) ? 0 : 1;
      if (leftFav !== rightFav) return leftFav - rightFav;
      return pairs.indexOf(left) - pairs.indexOf(right);
    });
  }, [pairs, favourites]);
