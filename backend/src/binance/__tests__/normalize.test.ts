/**
 * Binance frame parsing (R2, R3, R33).
 *
 * The case that justifies this file existing: Binance sends every numeric as a
 * string. `"64239.50" > "9000"` is `false`, so a missing `Number()` produces a
 * bug that looks like bad market data rather than a type error.
 */

import { buildStreamPath, normalizeFrame } from "../normalize";

const knownPairs = new Set(["BTCUSDT", "ETHUSDT"]);
const options = { depthLevels: 20, knownPairs };

describe("R3 depth frames", () => {
  it("R3 converts Binance's string numerics into numbers", () => {
    const frame = normalizeFrame(
      JSON.stringify({
        stream: "btcusdt@depth20@100ms",
        data: {
          bids: [["64239.50", "0.5"]],
          asks: [["64240.00", "1.25"]],
        },
      }),
      options,
    );

    expect(frame).toEqual({
      kind: "depth",
      pair: "BTCUSDT",
      payload: { bids: [[64239.5, 0.5]], asks: [[64240, 1.25]] },
    });
  });

  it("R6 caps levels at the configured depth", () => {
    const bids = Array.from({ length: 50 }, (_, index) => [`${100 - index}`, "1"]);

    const frame = normalizeFrame(
      JSON.stringify({ stream: "btcusdt@depth20@100ms", data: { bids, asks: [] } }),
      { depthLevels: 20, knownPairs },
    );

    // A misconfigured stream name must not be able to grow the snapshot beyond
    // its bound.
    expect(frame?.kind === "depth" && frame.payload.bids).toHaveLength(20);
  });

  it("R3 drops zero-quantity levels", () => {
    const frame = normalizeFrame(
      JSON.stringify({
        stream: "btcusdt@depth20@100ms",
        data: { bids: [["100", "0"], ["99", "1"]], asks: [["101", "1"]] },
      }),
      options,
    );

    // Binance uses zero quantity to mean "this price level is gone". Keeping it
    // would put a phantom level in the book and skew the pressure notional.
    expect(frame?.kind === "depth" && frame.payload.bids).toEqual([[99, 1]]);
  });
});

describe("R3 bookTicker and ticker frames", () => {
  it("R3 reads best bid and ask from a bookTicker frame", () => {
    const frame = normalizeFrame(
      JSON.stringify({
        stream: "ethusdt@bookTicker",
        data: { b: "3180.25", a: "3180.75" },
      }),
      options,
    );

    expect(frame).toEqual({
      kind: "bookTicker",
      pair: "ETHUSDT",
      payload: { bestBid: 3180.25, bestAsk: 3180.75 },
    });
  });

  it("R11 reads 24h statistics from a ticker frame", () => {
    const frame = normalizeFrame(
      JSON.stringify({
        stream: "btcusdt@ticker",
        data: { c: "64239.50", P: "2.45", h: "65000.00", l: "63000.00", v: "12345.67" },
      }),
      options,
    );

    expect(frame).toEqual({
      kind: "ticker",
      pair: "BTCUSDT",
      payload: {
        price: 64239.5,
        change24hPct: 2.45,
        high24h: 65000,
        low24h: 63000,
        volume24h: 12345.67,
      },
    });
  });

  it("R11 accepts a partial ticker frame rather than discarding it", () => {
    const frame = normalizeFrame(
      JSON.stringify({ stream: "btcusdt@ticker", data: { c: "64239.50" } }),
      options,
    );

    expect(frame?.kind === "ticker" && frame.payload).toEqual({ price: 64239.5 });
  });
});

describe("R33 malformed input", () => {
  it("R33 returns null for unparseable JSON instead of throwing", () => {
    // A single bad frame must not take down the socket carrying the other four
    // pairs, so parsing failures are values rather than exceptions.
    expect(normalizeFrame("{not json", options)).toBeNull();
  });

  it("R33 ignores pairs the gateway was not configured with", () => {
    const frame = normalizeFrame(
      JSON.stringify({ stream: "shibusdt@bookTicker", data: { b: "1", a: "2" } }),
      options,
    );

    expect(frame).toBeNull();
  });

  it("R33 ignores stream types it does not recognise", () => {
    // Binance adds stream types over time; an unknown one is not an error.
    const frame = normalizeFrame(
      JSON.stringify({ stream: "btcusdt@kline_1m", data: { k: {} } }),
      options,
    );

    expect(frame).toBeNull();
  });

  it("R33 rejects frames missing the combined-stream envelope", () => {
    expect(normalizeFrame(JSON.stringify({ data: { b: "1" } }), options)).toBeNull();
    expect(normalizeFrame(JSON.stringify({ stream: "btcusdt@ticker" }), options)).toBeNull();
    expect(normalizeFrame(JSON.stringify(null), options)).toBeNull();
  });

  it("R33 drops non-numeric values rather than propagating NaN", () => {
    const frame = normalizeFrame(
      JSON.stringify({ stream: "btcusdt@bookTicker", data: { b: "abc", a: "101" } }),
      options,
    );

    // NaN would reach the screen as "NaN" rather than failing loudly here.
    expect(frame).toBeNull();
  });
});

describe("R2 stream subscription", () => {
  it("R2 requests all three streams per pair on one combined socket", () => {
    const path = buildStreamPath(["BTCUSDT", "ETHUSDT"], 20);

    expect(path).toBe(
      "/stream?streams=btcusdt@depth20@100ms/btcusdt@bookTicker/btcusdt@ticker/" +
        "ethusdt@depth20@100ms/ethusdt@bookTicker/ethusdt@ticker",
    );
  });

  it("R2 lowercases symbols, which Binance requires in stream names", () => {
    // Uppercase symbols are silently ignored by Binance - the socket opens and
    // then never delivers anything, which is a miserable bug to chase.
    expect(buildStreamPath(["BTCUSDT"], 5)).toContain("btcusdt@depth5@100ms");
  });
});
