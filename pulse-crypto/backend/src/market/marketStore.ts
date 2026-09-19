/**
 * The conflation buffer. This is the centre of the assignment (R4, R6).
 *
 * ## Why there is no queue
 *
 * The obvious reading of "buffer and/or batch incoming updates" is a queue that
 * accumulates upstream messages and drains them on a timer. That design has an
 * unbounded failure mode built in: if ingest outruns drain - which it does,
 * because `@bookTicker` fires on every change while the emitter fires ten times
 * a second - the queue grows without limit, and a slow consumer holding a
 * reference to its own copy makes it worse per client.
 *
 * Instead each pair gets exactly one mutable snapshot, and an incoming message
 * **overwrites** the fields it carries. A dirty `Set` records which pairs moved
 * since the last flush. So:
 *
 *   memory = O(pairs) + O(pairs)      // snapshots + dirty keys
 *
 * independent of upstream message rate, client count, and how far behind the
 * slowest client is. Five pairs is five snapshots whether upstream is sending
 * 40 messages a second or 4000. That is the sentence that answers "prevent
 * unbounded memory growth", and `__tests__/marketStore.test.ts` asserts it
 * across 10k updates.
 *
 * ## Why dropping data is correct here, not a shortcut
 *
 * Latest-wins conflation loses intermediate ticks, and for market data that is
 * the *right* semantic rather than a compromise: a price from 40 ms ago has no
 * value to a human reading a chart once a newer price exists. A client that
 * misses three intermediate BTC prices and receives the fourth is not showing
 * stale data - it is showing current data. This is also what makes the
 * backpressure policy in `ws/clientRegistry.ts` safe: skipping a frame for a
 * lagging client costs it nothing but latency, because the next tick carries
 * the newest state rather than replaying history.
 *
 * The trade-off worth naming: this is wrong for anything that must see every
 * event - trade execution, audit logs, sequence-gap detection. Those need a
 * queue with an explicit overflow policy. See ADR-0001.
 */

import { stats } from "../stats";
import { Book, Level, PairUpdate } from "../types/protocol";
import { computePressure, computeSpread } from "./metrics";

/**
 * One pair's current state. Mutated in place - this object is allocated once
 * per pair at construction and never replaced, which keeps the allocation rate
 * flat under load and gives the GC nothing to do on the hot path.
 */
interface PairSnapshot {
  pair: string;
  timestamp: number;
  price: number;
  change24hPct: number;
  spread: number;
  spreadPct: number;
  buyPressure: number;
  sellPressure: number;
  bids: Level[];
  asks: Level[];
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  /** True once any upstream frame has landed, so `/pairs/meta` can say so. */
  hasLiveData: boolean;
  /**
   * Which fields moved since the last flush. Lets the emitter send only what
   * changed instead of a full snapshot every tick: `@ticker` updates roughly
   * once a second, so re-sending `change24hPct` at 10 Hz is nine wasted
   * fields out of ten.
   */
  dirtyFields: {
    price: boolean;
    change24hPct: boolean;
    spread: boolean;
    pressure: boolean;
    book: boolean;
  };
}

const emptyDirtyFields = (): PairSnapshot["dirtyFields"] => ({
  price: false,
  change24hPct: false,
  spread: false,
  pressure: false,
  book: false,
});

export interface DepthPayload {
  bids: Level[];
  asks: Level[];
}

export interface TickerPayload {
  price?: number;
  change24hPct?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
}

export interface BookTickerPayload {
  bestBid: number;
  bestAsk: number;
}

export class MarketStore {
  /** Fixed cardinality: one entry per configured pair, created up front. */
  private readonly snapshots = new Map<string, PairSnapshot>();

  /** Pairs touched since the last `drainDirty()`. Bounded by `snapshots.size`. */
  private readonly dirty = new Set<string>();

  constructor(pairs: readonly string[]) {
    for (const pair of pairs) {
      this.snapshots.set(pair, {
        pair,
        timestamp: 0,
        price: 0,
        change24hPct: 0,
        spread: 0,
        spreadPct: 0,
        buyPressure: 50,
        sellPressure: 50,
        bids: [],
        asks: [],
        high24h: null,
        low24h: null,
        volume24h: null,
        hasLiveData: false,
        dirtyFields: emptyDirtyFields(),
      });
    }
  }

  /** The memory bound, exposed so `/health` and the tests can assert on it. */
  get size(): number {
    return this.snapshots.size;
  }

  get dirtyCount(): number {
    return this.dirty.size;
  }

  hasPair(pair: string): boolean {
    return this.snapshots.has(pair);
  }

  pairs(): string[] {
    return [...this.snapshots.keys()];
  }

  /**
   * Apply a top-20 depth frame (R3).
   *
   * The level arrays are replaced wholesale rather than appended to - that
   * replacement is what keeps memory flat, since `bids` and `asks` are always
   * at most `depthLevels` long no matter how many frames arrive.
   */
  applyDepth(pair: string, payload: DepthPayload): void {
    const snapshot = this.snapshots.get(pair);
    if (!snapshot) return;

    snapshot.bids = payload.bids;
    snapshot.asks = payload.asks;
    snapshot.dirtyFields.book = true;

    const bestBid = payload.bids[0]?.[0];
    const bestAsk = payload.asks[0]?.[0];
    if (bestBid !== undefined && bestAsk !== undefined) {
      const { spread, spreadPct } = computeSpread(bestBid, bestAsk);
      if (spread !== snapshot.spread || spreadPct !== snapshot.spreadPct) {
        snapshot.spread = spread;
        snapshot.spreadPct = spreadPct;
        snapshot.dirtyFields.spread = true;
      }
    }

    const { buyPressure, sellPressure } = computePressure(payload.bids, payload.asks);
    if (buyPressure !== snapshot.buyPressure) {
      snapshot.buyPressure = buyPressure;
      snapshot.sellPressure = sellPressure;
      snapshot.dirtyFields.pressure = true;
    }

    this.touch(snapshot);
  }

  /**
   * Apply a best bid/ask frame. This is the highest-frequency stream - it fires
   * on every change to the touch, which for BTC is many times a second - and it
   * is the clearest illustration of conflation: dozens of these collapse into
   * one field on one snapshot between two emitter ticks.
   */
  applyBookTicker(pair: string, payload: BookTickerPayload): void {
    const snapshot = this.snapshots.get(pair);
    if (!snapshot) return;

    const { spread, spreadPct } = computeSpread(payload.bestBid, payload.bestAsk);
    if (spread !== snapshot.spread || spreadPct !== snapshot.spreadPct) {
      snapshot.spread = spread;
      snapshot.spreadPct = spreadPct;
      snapshot.dirtyFields.spread = true;
    }

    // Mid of the touch is a better "current price" than the last trade when the
    // book is moving faster than trades are printing, which is most of the time.
    const mid = (payload.bestBid + payload.bestAsk) / 2;
    if (mid > 0 && mid !== snapshot.price) {
      snapshot.price = mid;
      snapshot.dirtyFields.price = true;
    }

    this.touch(snapshot);
  }

  /** Apply a 24h rolling statistics frame (R11, R15 source data). */
  applyTicker(pair: string, payload: TickerPayload): void {
    const snapshot = this.snapshots.get(pair);
    if (!snapshot) return;

    if (payload.price !== undefined && payload.price !== snapshot.price) {
      snapshot.price = payload.price;
      snapshot.dirtyFields.price = true;
    }
    if (
      payload.change24hPct !== undefined &&
      payload.change24hPct !== snapshot.change24hPct
    ) {
      snapshot.change24hPct = payload.change24hPct;
      snapshot.dirtyFields.change24hPct = true;
    }
    if (payload.high24h !== undefined) snapshot.high24h = payload.high24h;
    if (payload.low24h !== undefined) snapshot.low24h = payload.low24h;
    if (payload.volume24h !== undefined) snapshot.volume24h = payload.volume24h;

    this.touch(snapshot);
  }

  private touch(snapshot: PairSnapshot): void {
    snapshot.timestamp = Date.now();
    snapshot.hasLiveData = true;
    // Set semantics are doing the conflation bookkeeping: adding a pair that is
    // already dirty is a no-op, so the set can never exceed the pair count.
    this.dirty.add(snapshot.pair);
  }

  /**
   * Take the dirty pair names and clear the set (R5).
   *
   * Returns names rather than payloads because the emitter needs to build a
   * different projection per subscription shape, and building all of them here
   * would mean the store knew about clients.
   */
  drainDirty(): string[] {
    if (this.dirty.size === 0) return [];
    const drained = [...this.dirty];
    this.dirty.clear();
    return drained;
  }

  /**
   * Project a snapshot onto the wire format.
   *
   * @param onlyChanged send just the fields dirtied since the last flush. False
   *   for the connect-time snapshot, which must be complete because the client
   *   has nothing to merge into (R12, R25).
   * @param includeBook attach depth. Only for clients that asked (R10 note).
   */
  project(pair: string, onlyChanged: boolean, includeBook: boolean): PairUpdate | null {
    const snapshot = this.snapshots.get(pair);
    if (!snapshot) return null;

    const update: PairUpdate = { pair: snapshot.pair, timestamp: snapshot.timestamp };
    const fields = snapshot.dirtyFields;

    if (!onlyChanged || fields.price) update.price = snapshot.price;
    if (!onlyChanged || fields.change24hPct) update.change24hPct = snapshot.change24hPct;
    if (!onlyChanged || fields.spread) {
      update.spread = snapshot.spread;
      update.spreadPct = snapshot.spreadPct;
    }
    if (!onlyChanged || fields.pressure) {
      update.buyPressure = snapshot.buyPressure;
      update.sellPressure = snapshot.sellPressure;
    }
    if (includeBook && (!onlyChanged || fields.book)) {
      update.book = { bids: snapshot.bids, asks: snapshot.asks };
    }

    return update;
  }

  /**
   * Clear per-field dirty flags. Called once per tick *after* every client's
   * payload has been projected - if it ran inside `project` the second client
   * of the tick would receive an empty update.
   */
  clearFieldFlags(pairs: readonly string[]): void {
    for (const pair of pairs) {
      const snapshot = this.snapshots.get(pair);
      if (snapshot) snapshot.dirtyFields = emptyDirtyFields();
    }
  }

  /** Full current state for every pair, for the connect-time snapshot. */
  projectAll(includeBook: boolean): PairUpdate[] {
    const updates: PairUpdate[] = [];
    for (const pair of this.snapshots.keys()) {
      const update = this.project(pair, false, includeBook);
      if (update) updates.push(update);
    }
    return updates;
  }

  /** Read-only view for `GET /pairs/meta` (R11). */
  readMeta(pair: string): Pick<
    PairSnapshot,
    "high24h" | "low24h" | "volume24h" | "hasLiveData" | "price"
  > | null {
    const snapshot = this.snapshots.get(pair);
    if (!snapshot) return null;
    return {
      price: snapshot.price,
      high24h: snapshot.high24h,
      low24h: snapshot.low24h,
      volume24h: snapshot.volume24h,
      hasLiveData: snapshot.hasLiveData,
    };
  }

  getBook(pair: string): Book | null {
    const snapshot = this.snapshots.get(pair);
    if (!snapshot) return null;
    return { bids: snapshot.bids, asks: snapshot.asks };
  }
}

/**
 * The process-wide store. A singleton because the conflation tier is
 * intentionally shared - one snapshot per pair for the whole gateway is the
 * point, and a per-connection store would reintroduce the O(clients) memory
 * growth the design exists to avoid.
 */
let instance: MarketStore | null = null;

export const getMarketStore = (pairs?: readonly string[]): MarketStore => {
  if (!instance) {
    if (!pairs) throw new Error("MarketStore has not been initialised with pairs");
    instance = new MarketStore(pairs);
    stats.registerProviders({ bufferedPairs: () => instance?.size ?? 0 });
  }
  return instance;
};

/** Test helper: drops the singleton so each suite starts clean. */
export const __resetMarketStoreForTests = (): void => {
  instance = null;
};
