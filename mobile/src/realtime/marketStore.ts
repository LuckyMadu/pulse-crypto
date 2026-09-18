/**
 * The keyed external store. This is the mobile half of the assignment's
 * architectural argument (R20, R31).
 *
 * ## Why this is not a Redux slice
 *
 * Five pairs at 10 Hz is ~50 updates a second. Dispatching each one to Redux
 * would, per update:
 *
 *   - run every reducer in the store,
 *   - run every `useSelector` in the mounted tree,
 *   - re-render every component whose selector result changed identity.
 *
 * Even with perfectly memoised selectors, the *checking* is O(subscribers) at
 * 50 Hz and it happens on the JS thread - the same thread that has to answer
 * touches. The visible symptom is not a crash, it is a frame rate that sags
 * under exactly the conditions the brief asks about.
 *
 * This store instead keeps a listener registry **per pair**. A BTC tick
 * notifies only the components reading BTC. The list itself never re-renders:
 * `MarketsScreen` renders rows once and each row subscribes independently. So
 * the cost of an update is proportional to the number of components displaying
 * *that pair*, which is one or two, rather than to the size of the tree.
 *
 * ## The `useSyncExternalStore` contract
 *
 * `getSnapshot` must return a **referentially stable** value between changes.
 * If it returned a fresh object each call, React would see a new value on every
 * render and loop forever. So per-pair state is stored as a frozen object whose
 * reference is swapped only when that pair actually changes - which also makes
 * `React.memo` on the row work without a custom comparator.
 */

import { Book, GatewayStats, PairUpdate, UpstreamState } from "../types/protocol";

/** One pair's current state as the UI consumes it. Immutable; never mutated. */
export interface Ticker {
  pair: string;
  price: number;
  change24hPct: number;
  spread: number;
  spreadPct: number;
  buyPressure: number;
  sellPressure: number;
  /** Server timestamp of the last update for this pair. Drives the live dot. */
  timestamp: number;
  /**
   * Direction of the most recent price change, for the flash (R21, R22).
   * `null` before the second update, so a pair does not flash on first paint.
   */
  direction: "up" | "down" | null;
  /** Monotonic per-pair counter. Lets a row detect "a tick happened" even when
   *  the price is unchanged, which is what keeps the live dot honest. */
  revision: number;
}

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

type Listener = () => void;

const EMPTY_BOOK: Book = Object.freeze({ bids: [], asks: [] });

const initialTicker = (pair: string): Ticker =>
  Object.freeze({
    pair,
    price: 0,
    change24hPct: 0,
    spread: 0,
    spreadPct: 0,
    buyPressure: 50,
    sellPressure: 50,
    timestamp: 0,
    direction: null,
    revision: 0,
  });

export class MarketStore {
  private tickers = new Map<string, Ticker>();
  private books = new Map<string, Book>();

  /** Per-pair listeners. The whole point: a BTC tick wakes only BTC readers. */
  private tickerListeners = new Map<string, Set<Listener>>();
  private bookListeners = new Map<string, Set<Listener>>();

  /** Low-frequency global state keeps a single listener set; it is cheap. */
  private globalListeners = new Set<Listener>();

  private status: ConnectionStatus = "connecting";
  private upstream: UpstreamState = "connecting";
  private stats: GatewayStats | null = null;
  private emitIntervalMs = 100;
  private pairOrder: string[] = [];

  // ---------------------------------------------------------------- reads

  /**
   * Stable per-pair snapshot. Safe to call on every render - it returns the
   * same reference until that pair changes.
   */
  getTicker = (pair: string): Ticker => {
    let ticker = this.tickers.get(pair);
    if (!ticker) {
      ticker = initialTicker(pair);
      this.tickers.set(pair, ticker);
    }
    return ticker;
  };

  getBook = (pair: string): Book => this.books.get(pair) ?? EMPTY_BOOK;

  getStatus = (): ConnectionStatus => this.status;
  getUpstream = (): UpstreamState => this.upstream;
  getStats = (): GatewayStats | null => this.stats;
  getEmitIntervalMs = (): number => this.emitIntervalMs;
  getPairs = (): string[] => this.pairOrder;

  // ----------------------------------------------------------- subscribe

  subscribeTicker = (pair: string, listener: Listener): (() => void) =>
    this.addListener(this.tickerListeners, pair, listener);

  subscribeBook = (pair: string, listener: Listener): (() => void) =>
    this.addListener(this.bookListeners, pair, listener);

  subscribeGlobal = (listener: Listener): (() => void) => {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  };

  private addListener(
    registry: Map<string, Set<Listener>>,
    key: string,
    listener: Listener,
  ): () => void {
    let listeners = registry.get(key);
    if (!listeners) {
      listeners = new Set();
      registry.set(key, listeners);
    }
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      // Drop the empty set so navigating between pairs does not leave a map
      // entry per pair ever visited.
      if (listeners.size === 0) registry.delete(key);
    };
  }

  // ----------------------------------------------------------- mutations

  /**
   * Apply a batch of pair updates from one server frame.
   *
   * Every pair in the frame is applied first, and listeners are notified
   * afterwards. Notifying inside the loop would tear: a component reading two
   * pairs would render once with the first updated and the second stale.
   */
  applyUpdates(updates: PairUpdate[]): void {
    const changedTickers: string[] = [];
    const changedBooks: string[] = [];

    for (const update of updates) {
      const previous = this.getTicker(update.pair);

      if (update.book) {
        this.books.set(update.pair, Object.freeze(update.book));
        changedBooks.push(update.pair);
      }

      const nextPrice = update.price ?? previous.price;

      // Direction is computed here rather than in the component because the
      // component may not render every tick - if the flash decision lived in
      // render, a skipped render would swallow the event.
      let direction = previous.direction;
      if (update.price !== undefined && previous.timestamp > 0) {
        if (nextPrice > previous.price) direction = "up";
        else if (nextPrice < previous.price) direction = "down";
      }

      this.tickers.set(
        update.pair,
        Object.freeze({
          pair: update.pair,
          price: nextPrice,
          change24hPct: update.change24hPct ?? previous.change24hPct,
          spread: update.spread ?? previous.spread,
          spreadPct: update.spreadPct ?? previous.spreadPct,
          buyPressure: update.buyPressure ?? previous.buyPressure,
          sellPressure: update.sellPressure ?? previous.sellPressure,
          timestamp: update.timestamp,
          direction,
          revision: previous.revision + 1,
        }),
      );
      changedTickers.push(update.pair);
    }

    for (const pair of changedTickers) this.notify(this.tickerListeners, pair);
    for (const pair of changedBooks) this.notify(this.bookListeners, pair);
  }

  /** Seed the display order from the server snapshot, before metadata loads. */
  setPairOrder(pairs: string[]): void {
    if (pairs.length === 0) return;
    const changed =
      pairs.length !== this.pairOrder.length ||
      pairs.some((pair, index) => pair !== this.pairOrder[index]);
    if (!changed) return;

    this.pairOrder = pairs;
    this.notifyGlobal();
  }

  setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.notifyGlobal();
  }

  setUpstream(upstream: UpstreamState): void {
    if (this.upstream === upstream) return;
    this.upstream = upstream;
    this.notifyGlobal();
  }

  setStats(stats: GatewayStats): void {
    this.stats = stats;
    this.emitIntervalMs = stats.emitIntervalMs;
    this.notifyGlobal();
  }

  setEmitIntervalMs(ms: number): void {
    if (this.emitIntervalMs === ms) return;
    this.emitIntervalMs = ms;
    this.notifyGlobal();
  }

  /**
   * Note there is no `clear()`.
   *
   * R25 requires the app keeps showing the last received data when the backend
   * goes away, so disconnect must not discard anything. The absence of this
   * method is the mechanism - there is no way to accidentally wipe the store
   * from a disconnect handler.
   */

  private notify(registry: Map<string, Set<Listener>>, key: string): void {
    const listeners = registry.get(key);
    if (!listeners) return;
    for (const listener of listeners) listener();
  }

  private notifyGlobal(): void {
    for (const listener of this.globalListeners) listener();
  }

  /** Test helper. */
  __resetForTests(): void {
    this.tickers.clear();
    this.books.clear();
    this.tickerListeners.clear();
    this.bookListeners.clear();
    this.globalListeners.clear();
    this.status = "connecting";
    this.upstream = "connecting";
    this.stats = null;
    this.pairOrder = [];
  }
}

export const marketStore = new MarketStore();
