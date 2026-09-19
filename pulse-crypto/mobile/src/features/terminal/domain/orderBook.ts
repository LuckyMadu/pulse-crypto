/**
 * Pure order book arithmetic for the terminal (R18, R23).
 *
 * This module exists separately from the components for the same reason
 * `backend/src/market/metrics.ts` exists separately from the store: the
 * accumulation and projection maths is the part most likely to be subtly
 * wrong, and keeping it free of React means it can be tested by calling a
 * function with two arrays.
 *
 * Before this module the same accumulation was written twice - once inside
 * `OrderBook`'s `useMemo` and once inside `MarketDepth`'s - and a third time
 * on the server. Two of the three were untested.
 */

import { Book, Level } from "@protocol";

export interface CumulativeLevel {
  price: number;
  quantity: number;
  /** Running total of quantity from the touch outwards to this level. */
  cumulative: number;
}

/**
 * Accumulate one side of the book outwards from the touch.
 *
 * Runs over every level it is given. Callers that display a subset must slice
 * *after* calling this: scaling bars against only the visible depth would make
 * the last visible row always render at 100%, which looks like a wall of
 * liquidity that is not there.
 *
 * Levels carrying a non-finite price or quantity are skipped rather than
 * poisoning the running total with `NaN`.
 */
export const accumulateLevels = (levels: Level[]): CumulativeLevel[] => {
  const rows: CumulativeLevel[] = [];
  let running = 0;

  for (const [price, quantity] of levels) {
    if (!Number.isFinite(price) || !Number.isFinite(quantity)) continue;
    running += quantity;
    rows.push({ price, quantity, cumulative: running });
  }

  return rows;
};

/** Total volume across an accumulated side, i.e. the last running total. */
export const totalVolume = (rows: CumulativeLevel[]): number =>
  rows[rows.length - 1]?.cumulative ?? 0;

export interface DepthGeometry {
  /** SVG path for the bid area, filling leftward from the mid. */
  bidPath: string;
  /** SVG path for the ask area, filling rightward from the mid. */
  askPath: string;
  /** X coordinate of the mid price line, in the 0-100 viewBox. */
  midX: number;
  midPrice: number;
  maxTotal: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Build an SVG area path for one side.
 *
 * The path walks the cumulative curve and then closes along the baseline, so
 * the fill is the area *under* the curve rather than a stroked line.
 */
export const buildAreaPath = (points: Point[], baselineY: number): string => {
  if (points.length < 2) return "";

  const [first, ...rest] = points;
  if (!first) return "";

  const line = rest.map(point => `L ${point.x} ${point.y}`).join(" ");
  const last = points[points.length - 1];
  if (!last) return "";

  return `M ${first.x} ${baselineY} L ${first.x} ${first.y} ${line} L ${last.x} ${baselineY} Z`;
};

/**
 * Project a book into the cumulative depth chart's geometry.
 *
 * Returns `null` rather than a degenerate shape whenever the book is too thin
 * to chart - fewer than two levels a side, a non-positive touch, no volume, or
 * a zero-width price window. The caller renders a waiting state for `null`.
 *
 * Work happens in a 0-100 x `chartHeight` viewBox so the geometry does not
 * depend on measuring the container.
 */
export const buildDepthGeometry = (book: Book, chartHeight: number): DepthGeometry | null => {
  const { bids, asks } = book;
  if (bids.length < 2 || asks.length < 2) return null;

  const bestBid = bids[0]?.[0] ?? 0;
  const bestAsk = asks[0]?.[0] ?? 0;
  if (bestBid <= 0 || bestAsk <= 0) return null;

  const midPrice = (bestBid + bestAsk) / 2;

  const bidCurve = accumulateLevels(bids);
  const askCurve = accumulateLevels(asks);

  const maxTotal = Math.max(totalVolume(bidCurve), totalVolume(askCurve));
  if (maxTotal <= 0) return null;

  // A symmetric price window around the mid, sized by whichever side reaches
  // further. Scaling each side independently would misrepresent the shape - a
  // wide-spread side would look artificially deep.
  const lowestBid = bidCurve[bidCurve.length - 1]?.price ?? midPrice;
  const highestAsk = askCurve[askCurve.length - 1]?.price ?? midPrice;
  const halfWindow = Math.max(midPrice - lowestBid, highestAsk - midPrice);
  if (halfWindow <= 0) return null;

  const toX = (price: number) => ((price - (midPrice - halfWindow)) / (halfWindow * 2)) * 100;
  const toY = (total: number) => chartHeight - (total / maxTotal) * chartHeight;

  // Bids are reversed so the path runs left-to-right like the asks, which
  // keeps `buildAreaPath` side-agnostic.
  const bidPoints = [...bidCurve]
    .reverse()
    .map(point => ({ x: toX(point.price), y: toY(point.cumulative) }));
  const askPoints = askCurve.map(point => ({ x: toX(point.price), y: toY(point.cumulative) }));

  return {
    bidPath: buildAreaPath(bidPoints, chartHeight),
    askPath: buildAreaPath(askPoints, chartHeight),
    midX: toX(midPrice),
    midPrice,
    maxTotal,
  };
};
