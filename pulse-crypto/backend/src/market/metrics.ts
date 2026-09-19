/**
 * Pure order book arithmetic. This module exists separately from the store for
 * one reason: the spread and pressure maths is the part most likely to be
 * subtly wrong, and keeping it free of sockets, timers and state means it can
 * be tested by calling a function with two arrays.
 */

import { Book, Level } from "../types/protocol";

export interface SpreadResult {
  spread: number;
  spreadPct: number;
}

/**
 * Absolute and relative top-of-book spread.
 *
 * Relative spread is taken against the mid price rather than the bid. Against
 * the bid it would be asymmetric - the same book would measure differently
 * depending on which side you divided by - and mid is the convention in market
 * data.
 */
export const computeSpread = (bestBid: number, bestAsk: number): SpreadResult => {
  if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) {
    return { spread: 0, spreadPct: 0 };
  }
  if (bestBid <= 0 || bestAsk <= 0) {
    return { spread: 0, spreadPct: 0 };
  }

  const spread = bestAsk - bestBid;
  const mid = (bestAsk + bestBid) / 2;

  return {
    spread: round(spread, 8),
    spreadPct: mid > 0 ? round((spread / mid) * 100, 6) : 0,
  };
};

export interface PressureResult {
  buyPressure: number;
  sellPressure: number;
}

/**
 * Order book imbalance across the visible levels, as a 0-100 split.
 *
 * Measured in **notional** (price x quantity), not raw quantity. Summing bare
 * quantities would let a large order far from the mid outweigh a larger amount
 * of real money sitting at the touch, which inverts the signal the number is
 * supposed to carry. Binance publishes no pressure metric, so this is a
 * documented derivation rather than a passthrough - see ADR-0001.
 *
 * An empty or one-sided book returns a neutral 50/50 rather than 0 or 100,
 * because "no information" and "all pressure one way" should not render the
 * same.
 */
export const computePressure = (bids: Level[], asks: Level[]): PressureResult => {
  const bidNotional = sumNotional(bids);
  const askNotional = sumNotional(asks);
  const total = bidNotional + askNotional;

  if (total <= 0) {
    return { buyPressure: 50, sellPressure: 50 };
  }

  const buyPressure = round((bidNotional / total) * 100, 2);
  return { buyPressure, sellPressure: round(100 - buyPressure, 2) };
};

const sumNotional = (levels: Level[]): number => {
  let total = 0;
  for (const level of levels) {
    const price = level[0];
    const quantity = level[1];
    if (Number.isFinite(price) && Number.isFinite(quantity) && price > 0 && quantity > 0) {
      total += price * quantity;
    }
  }
  return total;
};

export interface DepthPoint {
  price: number;
  /** Running total of quantity from the mid outwards to this level. */
  cumulative: number;
}

export interface CumulativeDepth {
  bids: DepthPoint[];
  asks: DepthPoint[];
  midPrice: number;
  /** Largest cumulative value on either side, for scaling the chart's y axis. */
  maxCumulative: number;
}

/**
 * Cumulative depth curves for the market-depth chart.
 *
 * Accumulation runs outwards from the mid on both sides, which is what makes
 * the classic depth chart shape: each point answers "how much volume is
 * available between the mid and this price". The client renders bids
 * accumulating leftward and asks rightward.
 *
 * Computed on the client in this build - it is included here because it is the
 * same maths, it is pure, and the only reason not to serve it is that the
 * client already has the book.
 */
export const computeCumulativeDepth = (book: Book): CumulativeDepth => {
  const bestBid = book.bids[0]?.[0] ?? 0;
  const bestAsk = book.asks[0]?.[0] ?? 0;
  const midPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;

  const bids = accumulate(book.bids);
  const asks = accumulate(book.asks);

  const maxCumulative = Math.max(
    bids[bids.length - 1]?.cumulative ?? 0,
    asks[asks.length - 1]?.cumulative ?? 0,
  );

  return { bids, asks, midPrice, maxCumulative };
};

const accumulate = (levels: Level[]): DepthPoint[] => {
  const points: DepthPoint[] = [];
  let running = 0;

  for (const level of levels) {
    const price = level[0];
    const quantity = level[1];
    if (!Number.isFinite(price) || !Number.isFinite(quantity)) continue;
    running += quantity;
    points.push({ price, cumulative: round(running, 8) });
  }

  return points;
};

/**
 * Fixed-decimal rounding that avoids the string round-trip of `toFixed`.
 *
 * Worth bounding: this runs on every level of every pair on every upstream
 * frame, so at 2000 msg/s it is on the hot path.
 */
const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
