/**
 * The wire contract between the gateway and its clients. This file is the single
 * source of truth for R9 and R10 and is copied verbatim into the mobile app by
 * `npm run sync:protocol`, so it must not import anything.
 *
 * Design notes worth defending at review:
 *
 *  - Order book levels are `[price, quantity]` tuples rather than
 *    `{ price, quantity }` objects. At 10 Hz with 40 levels per pair the key
 *    names would be ~40% of the frame, repeated forever, for zero information.
 *
 *  - One frame per tick carries an array of pairs rather than one frame per
 *    pair. Five pairs at 10 Hz is 10 frames/s instead of 50, and each element
 *    still names its own pair so a client can route without positional
 *    assumptions.
 *
 *  - `book` is optional because only a client that has sent `subscribeDepth`
 *    needs it. The watchlist renders no order book; pushing five 20-level books
 *    at it would be pure waste.
 */

/** A single order book level: `[price, quantity]`. */
export type Level = [number, number];

/** Top-of-book depth, capped at `DEPTH_LEVELS` levels per side, best first. */
export interface Book {
  bids: Level[];
  asks: Level[];
}

/**
 * Everything the client knows about one trading pair at one instant.
 *
 * Fields are individually optional because the three upstream streams arrive
 * independently: `@bookTicker` moves `spread` many times a second while
 * `@ticker` moves `change24hPct` about once. Sending only what changed is the
 * payoff of conflating per field rather than per message.
 */
export interface PairUpdate {
  /** R9: every update names its pair. Binance symbol form, e.g. `BTCUSDT`. */
  pair: string;
  /** Epoch ms when the gateway last touched this pair's snapshot. */
  timestamp: number;
  price?: number;
  change24hPct?: number;
  /** Absolute best ask minus best bid, in quote currency. */
  spread?: number;
  /** `spread` as a percentage of the mid price. */
  spreadPct?: number;
  /** Bid notional share of top-of-book notional, 0-100. See ADR-0001. */
  buyPressure?: number;
  /** Ask notional share of top-of-book notional, 0-100. `100 - buyPressure`. */
  sellPressure?: number;
  /** Present only for pairs this client subscribed to via `subscribeDepth`. */
  book?: Book;
}

/** Health of the gateway's own connection to Binance. */
export type UpstreamState = "connecting" | "connected" | "reconnecting" | "synthetic";

/** Static-ish metadata served by `GET /pairs/meta` (R11). */
export interface PairMeta {
  pair: string;
  /** Human form, e.g. `BTC/USDT`. */
  displayName: string;
  baseAsset: string;
  quoteAsset: string;
  /** `TRADING` when Binance is quoting it, `UNKNOWN` before upstream connects. */
  status: string;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  /** Decimals to render prices at. Static per pair; BTC needs 2, DOGE needs 5. */
  priceDecimals: number;
  /** Mocked from a static supply table - Binance does not publish supply. */
  marketCapUsd: number | null;
  /** `true` when high/low/volume came from the live `@ticker` stream. */
  live: boolean;
}

/** Counters shared by `GET /health` and the `stats` frame, so the two agree. */
export interface GatewayStats {
  /** Raw frames per second arriving from Binance (or the synthetic feed). */
  upstreamMsgsPerSec: number;
  /** Frames per second the gateway emits to each client. */
  emitsPerSec: number;
  /** Current emitter period in ms. Mirrors the Update Frequency slider. */
  emitIntervalMs: number;
  /** Frames skipped because a client was over its send budget (R6). */
  droppedFrames: number;
  /** Clients terminated for sustained backpressure (R6). */
  terminatedClients: number;
  connectedClients: number;
  upstream: UpstreamState;
  /** Resident set size in bytes. Flat under load is the R6 evidence. */
  rssBytes: number;
  heapUsedBytes: number;
  /** Pairs held in the conflation map. This is the memory bound: O(pairs). */
  bufferedPairs: number;
  upstreamMsgsTotal: number;
  emitsTotal: number;
  uptimeSec: number;
}

export type ServerMessage =
  /** Sent once on connect so a new client paints immediately (R12, R25). */
  | { type: "snapshot"; serverTime: number; pairs: PairUpdate[] }
  /** Sent every `emitIntervalMs`, carrying only pairs that changed (R5). */
  | { type: "update"; serverTime: number; pairs: PairUpdate[] }
  /** Upstream health, so the client can distinguish its own outage from ours. */
  | { type: "status"; upstream: UpstreamState; serverTime: number }
  /** Telemetry, sent once a second. Drives the Telemetry screen. */
  | { type: "stats"; serverTime: number; stats: GatewayStats }
  /** Echo of an accepted `setEmitInterval`, after server-side clamping. */
  | { type: "config"; emitIntervalMs: number }
  /** A client message was malformed or out of range. */
  | { type: "error"; message: string };

export type ClientMessage =
  /** Opt in to order book depth for these pairs. Replaces any prior set. */
  | { type: "subscribeDepth"; pairs: string[] }
  /** Retune the shared emitter. Clamped server-side; see README assumptions. */
  | { type: "setEmitInterval"; ms: number };

/** Narrowing guard for untrusted client input. Never trust `JSON.parse`. */
export const isClientMessage = (value: unknown): value is ClientMessage => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { type?: unknown; pairs?: unknown; ms?: unknown };

  if (candidate.type === "subscribeDepth") {
    return (
      Array.isArray(candidate.pairs) &&
      candidate.pairs.every(pair => typeof pair === "string")
    );
  }
  if (candidate.type === "setEmitInterval") {
    return typeof candidate.ms === "number" && Number.isFinite(candidate.ms);
  }
  return false;
};
