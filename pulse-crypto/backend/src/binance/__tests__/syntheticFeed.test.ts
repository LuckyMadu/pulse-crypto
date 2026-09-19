/**
 * The load generator (R20).
 *
 * The generator is demo scaffolding, so it would be easy to argue it does not
 * need tests. It does, for one specific reason: the bug it shipped with was
 * invisible in the aggregate. Ingest showed ~2000 msg/s, memory stayed flat and
 * every headline number on the Telemetry screen looked right, while BTCUSDT
 * silently received no order book at all. A generator that lies makes every
 * demonstration built on it worthless, so the distribution is worth asserting.
 */

import { MarketStore } from "../../market/marketStore";
import { SyntheticFeed } from "../syntheticFeed";

const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOGEUSDT", "XRPUSDT"] as const;

describe("R20 synthetic feed distribution", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("R20 feeds every stream type to every pair, not just to one of them", () => {
    jest.useFakeTimers();
    const store = new MarketStore(PAIRS);
    const feed = new SyntheticFeed({ store, msgsPerSec: 2_000 });

    feed.start();
    jest.advanceTimersByTime(5_000);
    feed.stop();

    for (const pair of PAIRS) {
      const meta = store.readMeta(pair);
      const book = store.getBook(pair);

      // The regression: pair rotation is mod 5, so a stream cadence that is a
      // multiple of 5 lands on the same pair forever. Before the fix, four of
      // these five assertions failed - and nothing else in the system noticed.
      expect(book?.bids.length ?? 0).toBeGreaterThan(0);
      expect(book?.asks.length ?? 0).toBeGreaterThan(0);
      expect(meta?.high24h).not.toBeNull();
      expect(meta?.volume24h).not.toBeNull();
    }
  });

  it("R20 holds memory at O(pairs) while generating a sustained burst", () => {
    jest.useFakeTimers();
    const store = new MarketStore(PAIRS);
    const feed = new SyntheticFeed({ store, msgsPerSec: 2_000 });

    feed.start();
    jest.advanceTimersByTime(10_000);
    feed.stop();

    // ~20,000 generated messages later, the buffer is still five entries.
    expect(store.size).toBe(PAIRS.length);
    expect(store.dirtyCount).toBeLessThanOrEqual(PAIRS.length);
  });

  it("R20 keeps prices in a plausible range rather than random-walking away", () => {
    jest.useFakeTimers();
    const store = new MarketStore(PAIRS);
    const feed = new SyntheticFeed({ store, msgsPerSec: 2_000 });

    feed.start();
    jest.advanceTimersByTime(30_000);
    feed.stop();

    // Mean reversion keeps BTC near its seed. A pure random walk would drift
    // far enough over a few minutes to look obviously fake on camera.
    const price = store.readMeta("BTCUSDT")?.price ?? 0;
    expect(price).toBeGreaterThan(50_000);
    expect(price).toBeLessThan(80_000);
  });

  it("R20 stops generating once stopped", () => {
    jest.useFakeTimers();
    const store = new MarketStore(PAIRS);
    const feed = new SyntheticFeed({ store, msgsPerSec: 2_000 });

    feed.start();
    jest.advanceTimersByTime(1_000);
    feed.stop();
    store.drainDirty();

    jest.advanceTimersByTime(5_000);

    // A leaked interval would keep the process alive after shutdown and keep
    // the ingestion counter climbing after the feed was meant to be off.
    expect(store.drainDirty()).toEqual([]);
  });
});
