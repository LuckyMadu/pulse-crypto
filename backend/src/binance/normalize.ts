/**
 * Translation from Binance's wire format into the store's vocabulary.
 *
 * This is a separate module from `upstreamClient` because it is the only part
 * of ingest that has interesting failure modes, and it is pure. Binance sends
 * every numeric as a **string** (`"64239.50"`), which is the single most
 * common source of bugs against this API: `"64239.50" > "9000"` is `false`
 * because JavaScript compares those lexicographically. So every field goes
 * through `toNumber`, and anything unparseable is dropped rather than allowed
 * to propagate as `NaN`.
 */

import { Level } from "../types/protocol";
import { logger } from "../utils/logger";
import { BookTickerPayload, DepthPayload, TickerPayload } from "../market/marketStore";

/** Binance's combined-stream envelope: `{ stream, data }`. */
interface CombinedFrame {
  stream?: unknown;
  data?: unknown;
}

export type NormalizedFrame =
  | { kind: "depth"; pair: string; payload: DepthPayload }
  | { kind: "bookTicker"; pair: string; payload: BookTickerPayload }
  | { kind: "ticker"; pair: string; payload: TickerPayload };

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * `[["64239.50","0.5"], ...]` -> `[[64239.5, 0.5], ...]`.
 *
 * Zero-quantity levels are dropped: Binance uses them to mean "this price is
 * gone" in diff streams, and although the partial-depth stream we consume
 * should not contain them, filtering costs nothing and stops a zero-quantity
 * level from skewing the pressure notional. `slice` caps the array so a
 * misconfigured stream name cannot grow the snapshot.
 */
const toLevels = (value: unknown, maxLevels: number): Level[] => {
  if (!Array.isArray(value)) return [];

  const levels: Level[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry)) continue;
    const price = toNumber(entry[0]);
    const quantity = toNumber(entry[1]);
    if (price === undefined || quantity === undefined) continue;
    if (price <= 0 || quantity <= 0) continue;
    levels.push([price, quantity]);
    if (levels.length >= maxLevels) break;
  }
  return levels;
};

/**
 * Parse one combined-stream frame.
 *
 * Returns `null` for anything unrecognised rather than throwing: a single
 * malformed frame - or a stream type Binance adds later - must not take down
 * the socket that is carrying the other four pairs (R33).
 */
export const normalizeFrame = (
  raw: string,
  options: { depthLevels: number; knownPairs: ReadonlySet<string> },
): NormalizedFrame | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.debug("[normalize] dropped unparseable frame");
    return null;
  }

  // `JSON.parse("null")` succeeds and yields `null`, so the object check has to
  // come before any property access.
  if (typeof parsed !== "object" || parsed === null) return null;

  const frame = parsed as CombinedFrame;
  if (typeof frame.stream !== "string" || typeof frame.data !== "object" || !frame.data) {
    return null;
  }

  // `stream` looks like `btcusdt@depth20@100ms`. The symbol is the first
  // segment; the rest identifies the stream type.
  const separator = frame.stream.indexOf("@");
  if (separator <= 0) return null;

  const pair = frame.stream.slice(0, separator).toUpperCase();
  if (!options.knownPairs.has(pair)) return null;

  const streamType = frame.stream.slice(separator + 1);
  const data = frame.data as Record<string, unknown>;

  if (streamType.startsWith("depth")) {
    const bids = toLevels(data.bids, options.depthLevels);
    const asks = toLevels(data.asks, options.depthLevels);
    if (bids.length === 0 && asks.length === 0) return null;
    return { kind: "depth", pair, payload: { bids, asks } };
  }

  if (streamType === "bookTicker") {
    const bestBid = toNumber(data.b);
    const bestAsk = toNumber(data.a);
    if (bestBid === undefined || bestAsk === undefined) return null;
    return { kind: "bookTicker", pair, payload: { bestBid, bestAsk } };
  }

  if (streamType === "ticker") {
    const payload: TickerPayload = {};
    const last = toNumber(data.c);
    const changePct = toNumber(data.P);
    const high = toNumber(data.h);
    const low = toNumber(data.l);
    const volume = toNumber(data.v);

    if (last !== undefined) payload.price = last;
    if (changePct !== undefined) payload.change24hPct = changePct;
    if (high !== undefined) payload.high24h = high;
    if (low !== undefined) payload.low24h = low;
    if (volume !== undefined) payload.volume24h = volume;

    if (Object.keys(payload).length === 0) return null;
    return { kind: "ticker", pair, payload };
  }

  return null;
};

/**
 * Build the combined-stream path for every pair (R2).
 *
 * One socket carrying `N x 3` streams rather than `N x 3` sockets: Binance
 * rate-limits connections far more aggressively than streams per connection,
 * and one socket means one reconnect path to get right instead of fifteen.
 */
export const buildStreamPath = (
  pairs: readonly string[],
  depthLevels: number,
): string => {
  const streams = pairs.flatMap(pair => {
    const symbol = pair.toLowerCase();
    return [
      `${symbol}@depth${depthLevels}@100ms`,
      `${symbol}@bookTicker`,
      `${symbol}@ticker`,
    ];
  });
  return `/stream?streams=${streams.join("/")}`;
};
