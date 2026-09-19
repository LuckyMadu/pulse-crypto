/**
 * The conflation buffer (R4, R6). These are the tests that matter most in this
 * repo: they are the difference between the README *claiming* bounded memory
 * and the property being checkable.
 */

import { MarketStore } from "../marketStore";

const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOGEUSDT", "XRPUSDT"] as const;

const makeStore = () => new MarketStore(PAIRS);

describe("R4 conflation", () => {
  it("R4 overwrites rather than accumulates, so a pair holds only its latest state", () => {
    const store = makeStore();

    store.applyBookTicker("BTCUSDT", { bestBid: 100, bestAsk: 101 });
    store.applyBookTicker("BTCUSDT", { bestBid: 200, bestAsk: 201 });
    store.applyBookTicker("BTCUSDT", { bestBid: 300, bestAsk: 301 });

    const update = store.project("BTCUSDT", false, false);

    // Three messages in, one value out: the mid of the last one. Not a queue of
    // three, not an average.
    expect(update?.price).toBe(300.5);
  });

  it("R6 keeps memory at O(pairs) across 10,000 updates", () => {
    const store = makeStore();

    for (let index = 0; index < 10_000; index += 1) {
      const pair = PAIRS[index % PAIRS.length]!;
      const price = 100 + index;

      store.applyBookTicker(pair, { bestBid: price, bestAsk: price + 1 });
      store.applyDepth(pair, {
        bids: [[price - 1, 1]],
        asks: [[price + 2, 1]],
      });
    }

    // 20,000 applied messages later the buffer is still exactly five entries.
    // This is the assertion behind "prevents unbounded memory growth": the
    // bound is the pair count, and it is independent of message volume.
    expect(store.size).toBe(PAIRS.length);
    expect(store.dirtyCount).toBeLessThanOrEqual(PAIRS.length);
  });

  it("R6 caps each pair's order book at the levels supplied, never appending", () => {
    const store = makeStore();

    for (let index = 0; index < 1_000; index += 1) {
      store.applyDepth("ETHUSDT", {
        bids: [
          [3000 - index, 1],
          [2999 - index, 1],
        ],
        asks: [[3001 + index, 1]],
      });
    }

    const book = store.getBook("ETHUSDT");

    // The level arrays are replaced wholesale. If they were appended to, this
    // would be 2,000 entries deep after a few seconds of real traffic.
    expect(book?.bids).toHaveLength(2);
    expect(book?.asks).toHaveLength(1);
  });

  it("R4 ignores pairs it was not configured with", () => {
    const store = makeStore();

    store.applyBookTicker("NOTAPAIR", { bestBid: 1, bestAsk: 2 });

    // No entry is created, so a malformed or unexpected stream name cannot grow
    // the map - which is the other half of the O(pairs) bound.
    expect(store.size).toBe(PAIRS.length);
    expect(store.drainDirty()).toEqual([]);
  });
});

describe("R5 dirty-set flushing", () => {
  it("R5 reports only pairs that changed, not every configured pair", () => {
    const store = makeStore();

    store.applyBookTicker("BTCUSDT", { bestBid: 100, bestAsk: 101 });
    store.applyBookTicker("ETHUSDT", { bestBid: 200, bestAsk: 201 });

    expect(store.drainDirty().sort()).toEqual(["BTCUSDT", "ETHUSDT"]);
  });

  it("R5 lists a pair once however many times it changed between flushes", () => {
    const store = makeStore();

    for (let index = 0; index < 500; index += 1) {
      store.applyBookTicker("SOLUSDT", { bestBid: 100 + index, bestAsk: 101 + index });
    }

    // 500 upstream messages collapse into one entry in the flush. This ratio is
    // exactly what the Telemetry screen's ingest-vs-emit comparison visualises.
    expect(store.drainDirty()).toEqual(["SOLUSDT"]);
  });

  it("R5 drains to empty, so an idle tick sends nothing at all", () => {
    const store = makeStore();

    store.applyBookTicker("XRPUSDT", { bestBid: 0.5, bestAsk: 0.51 });

    expect(store.drainDirty()).toEqual(["XRPUSDT"]);
    expect(store.drainDirty()).toEqual([]);
  });

  it("R5 sends only the fields that moved once flags are cleared", () => {
    const store = makeStore();

    store.applyTicker("BTCUSDT", { price: 64_000, change24hPct: 2.5, high24h: 65_000 });
    store.clearFieldFlags(store.drainDirty());

    // Only the spread moved this round.
    store.applyBookTicker("BTCUSDT", { bestBid: 63_999, bestAsk: 64_001 });
    const delta = store.project("BTCUSDT", true, false);

    expect(delta?.spread).toBeDefined();
    // `change24hPct` moves about once a second; re-sending it at 10 Hz would be
    // nine wasted fields out of every ten.
    expect(delta?.change24hPct).toBeUndefined();
  });

  it("R12 projects a complete snapshot for a newly connected client", () => {
    const store = makeStore();

    store.applyTicker("BTCUSDT", { price: 64_000, change24hPct: 2.5 });
    store.clearFieldFlags(store.drainDirty());

    const snapshot = store.project("BTCUSDT", false, false);

    // A new client has nothing to merge into, so it must get everything even
    // though nothing is currently flagged dirty.
    expect(snapshot?.price).toBe(64_000);
    expect(snapshot?.change24hPct).toBe(2.5);
    expect(snapshot?.buyPressure).toBeDefined();
  });

  it("R12 snapshots every configured pair, including ones that never ticked", () => {
    const store = makeStore();

    store.applyBookTicker("BTCUSDT", { bestBid: 100, bestAsk: 101 });

    // The watchlist must render five rows immediately (R12), so a pair with no
    // data yet still appears - with a zero price rather than being absent.
    expect(store.projectAll(false)).toHaveLength(PAIRS.length);
  });
});

describe("R10 depth subscription gating", () => {
  it("R10 omits the order book unless the client asked for it", () => {
    const store = makeStore();

    store.applyDepth("BTCUSDT", { bids: [[100, 1]], asks: [[101, 1]] });

    expect(store.project("BTCUSDT", false, false)?.book).toBeUndefined();
    expect(store.project("BTCUSDT", false, true)?.book).toEqual({
      bids: [[100, 1]],
      asks: [[101, 1]],
    });
  });
});

describe("R25 retention", () => {
  it("R25 retains the last known snapshot with nothing flagged dirty", () => {
    const store = makeStore();

    store.applyTicker("BTCUSDT", { price: 64_000 });
    store.clearFieldFlags(store.drainDirty());

    // This is what lets the gateway keep serving prices while upstream is down,
    // and in turn what lets the app keep showing them: the store is keyed
    // state, so there is nothing to expire.
    expect(store.drainDirty()).toEqual([]);
    expect(store.project("BTCUSDT", false, false)?.price).toBe(64_000);
  });
});
