/**
 * The pure order book maths. These are cheap tests, but they cover the two
 * numbers a reviewer is most likely to eyeball against the screen and find
 * wrong: the spread and the pressure split.
 *
 * R34: this file imports no socket, no store and no config. That the maths can
 * be tested in isolation is the separation of concerns, demonstrated rather
 * than claimed - the alternative design computes these inside the ingest
 * handler, where they are only reachable through a live connection.
 */

import { computePressure, computeSpread } from "../metrics";

describe("R18 spread", () => {
  it("R18 computes absolute spread and expresses it relative to the mid price", () => {
    const { spread, spreadPct } = computeSpread(100, 102);

    expect(spread).toBe(2);
    // Against the mid (101), not the bid - 2/101, not 2/100.
    expect(spreadPct).toBeCloseTo(1.980198, 5);
  });

  it("R18 returns zero rather than Infinity or NaN for a degenerate book", () => {
    // Binance sends numbers as strings, so a parse slip lands here as 0 or NaN.
    // Propagating NaN would render as "NaN%" on the detail screen.
    expect(computeSpread(0, 102)).toEqual({ spread: 0, spreadPct: 0 });
    expect(computeSpread(100, 0)).toEqual({ spread: 0, spreadPct: 0 });
    expect(computeSpread(Number.NaN, 102)).toEqual({ spread: 0, spreadPct: 0 });
  });

  it("R18 reports a crossed book as a negative spread instead of hiding it", () => {
    // A crossed book is real, if rare, and clamping it to zero would mean the
    // screen silently lied about market state.
    expect(computeSpread(102, 100).spread).toBe(-2);
  });
});

describe("R18 buy/sell pressure", () => {
  it("R18 weights levels by notional, not by raw quantity", () => {
    // Bids: 1 unit at 100 = 100 notional.
    // Asks: 10 units at 10 = 100 notional.
    // By quantity this is 1 vs 10 and looks overwhelmingly sell-side. By
    // notional it is balanced, which is the honest reading - equal money on
    // each side.
    const { buyPressure, sellPressure } = computePressure([[100, 1]], [[10, 10]]);

    expect(buyPressure).toBe(50);
    expect(sellPressure).toBe(50);
  });

  it("R18 splits proportionally and always sums to 100", () => {
    const { buyPressure, sellPressure } = computePressure(
      [
        [100, 3],
        [99, 1],
      ],
      [[101, 1]],
    );

    // Bid notional 300 + 99 = 399, ask notional 101. 399/500 = 79.8%.
    expect(buyPressure).toBeCloseTo(79.8, 1);
    expect(buyPressure + sellPressure).toBe(100);
  });

  it("R18 reports an empty book as neutral rather than as zero pressure", () => {
    // "No data" and "all pressure sell-side" must not render identically.
    expect(computePressure([], [])).toEqual({ buyPressure: 50, sellPressure: 50 });
  });

  it("R18 ignores zero and negative levels instead of letting them skew notional", () => {
    const withJunk = computePressure(
      [
        [100, 1],
        [0, 5],
        [-1, 5],
      ],
      [[100, 1]],
    );

    expect(withJunk).toEqual({ buyPressure: 50, sellPressure: 50 });
  });
});
