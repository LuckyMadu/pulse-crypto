/**
 * The terminal's order book arithmetic (R18, R23).
 *
 * This maths used to live inside `OrderBook` and `MarketDepth`, where the only
 * way to exercise it was to render a chart. The cases that matter are the
 * degenerate books - a one-sided book, a zero-width price window, a book too
 * thin to chart - because those are what arrive in the first second after a
 * connection and none of them should produce a broken shape.
 */

import { Book, Level } from "@protocol";
import {
  accumulateLevels,
  buildAreaPath,
  buildDepthGeometry,
  totalVolume,
} from "../orderBook";

const CHART_HEIGHT = 120;

const book = (bids: Level[], asks: Level[]): Book => ({ bids, asks });

describe("R18 accumulateLevels", () => {
  it("R18 accumulates quantity outwards from the touch", () => {
    const rows = accumulateLevels([
      [99, 1],
      [98, 2],
      [97, 3],
    ]);

    expect(rows.map(row => row.cumulative)).toEqual([1, 3, 6]);
    expect(rows.map(row => row.quantity)).toEqual([1, 2, 3]);
  });

  it("R18 skips levels with a non-finite price or quantity rather than poisoning the total", () => {
    const rows = accumulateLevels([
      [99, 1],
      [Number.NaN, 5],
      [98, Number.POSITIVE_INFINITY],
      [97, 2],
    ]);

    expect(rows).toHaveLength(2);
    expect(totalVolume(rows)).toBe(3);
  });

  it("R18 reports zero total volume for an empty side", () => {
    expect(totalVolume(accumulateLevels([]))).toBe(0);
  });

  /**
   * The bug this guards against: scaling the depth bars against only the eight
   * visible levels would make the eighth row always render at 100%, which
   * reads as a wall of liquidity that is not in the book.
   */
  it("R18 totals the full book so a visible slice does not rescale the bars", () => {
    const levels: Level[] = Array.from({ length: 20 }, (_, i) => [100 - i, 1]);
    const rows = accumulateLevels(levels);

    expect(totalVolume(rows)).toBe(20);
    expect(rows.slice(0, 8)[7]?.cumulative).toBe(8);
  });
});

describe("R23 buildDepthGeometry", () => {
  it("R23 projects both sides into a 0-100 viewBox split at the mid", () => {
    const geometry = buildDepthGeometry(
      book(
        [
          [99, 1],
          [98, 2],
        ],
        [
          [101, 1],
          [102, 2],
        ],
      ),
      CHART_HEIGHT,
    );

    expect(geometry).not.toBeNull();
    expect(geometry?.midPrice).toBe(100);
    expect(geometry?.maxTotal).toBe(3);
    // A symmetric window around the mid puts the mid line exactly halfway.
    expect(geometry?.midX).toBeCloseTo(50);
    expect(geometry?.bidPath).toMatch(/^M /);
    expect(geometry?.askPath).toMatch(/Z$/);
  });

  it("R23 returns null for a book too thin to chart", () => {
    expect(buildDepthGeometry(book([[99, 1]], [[101, 1]]), CHART_HEIGHT)).toBeNull();
    expect(buildDepthGeometry(book([], []), CHART_HEIGHT)).toBeNull();
  });

  it("R23 returns null rather than dividing by zero on a zero-width window", () => {
    const flat = buildDepthGeometry(
      book(
        [
          [100, 1],
          [100, 1],
        ],
        [
          [100, 1],
          [100, 1],
        ],
      ),
      CHART_HEIGHT,
    );

    expect(flat).toBeNull();
  });

  it("R23 returns null when the book has levels but no volume", () => {
    const empty = buildDepthGeometry(
      book(
        [
          [99, 0],
          [98, 0],
        ],
        [
          [101, 0],
          [102, 0],
        ],
      ),
      CHART_HEIGHT,
    );

    expect(empty).toBeNull();
  });

  it("R23 scales the y axis to the chart height it is given", () => {
    const short = buildDepthGeometry(
      book(
        [
          [99, 1],
          [98, 1],
        ],
        [
          [101, 1],
          [102, 1],
        ],
      ),
      10,
    );

    // The deepest point sits at y=0; the baseline is the chart height.
    expect(short?.bidPath).toContain(" 10 ");
  });
});

describe("R23 buildAreaPath", () => {
  it("R23 closes the path along the baseline so the area fills under the curve", () => {
    const path = buildAreaPath(
      [
        { x: 0, y: 100 },
        { x: 50, y: 20 },
      ],
      120,
    );

    expect(path).toBe("M 0 120 L 0 100 L 50 20 L 50 120 Z");
  });

  it("R23 yields an empty path for fewer than two points", () => {
    expect(buildAreaPath([], 120)).toBe("");
    expect(buildAreaPath([{ x: 1, y: 2 }], 120)).toBe("");
  });
});
