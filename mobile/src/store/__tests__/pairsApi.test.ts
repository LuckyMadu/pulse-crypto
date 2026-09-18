/**
 * The `/pairs/meta` normalizer (R11, R12).
 *
 * This is the boundary where a malformed or partial server response would
 * otherwise become a crash inside a list row, so it is worth pinning down
 * exactly what it tolerates.
 */

import { PairMeta } from "@protocol";
import { normalizePairsMeta } from "../redux/api/pairsApi";

const meta = (pair: string, overrides: Partial<PairMeta> = {}): PairMeta => ({
  pair,
  displayName: `${pair.replace("USDT", "")}/USDT`,
  baseAsset: pair.replace("USDT", ""),
  quoteAsset: "USDT",
  status: "TRADING",
  high24h: 1,
  low24h: 1,
  volume24h: 1,
  priceDecimals: 2,
  marketCapUsd: 1,
  live: true,
  ...overrides,
});

describe("R11 normalizePairsMeta", () => {
  it("R11 keys pairs for O(1) lookup while preserving server order", () => {
    const result = normalizePairsMeta({
      pairs: [meta("BTCUSDT"), meta("ETHUSDT")],
      serverTime: 1000,
    });

    // Order drives the watchlist; the map is what rows look themselves up in
    // on every render, which an array `find` would make O(n) per row.
    expect(result.order).toEqual(["BTCUSDT", "ETHUSDT"]);
    expect(result.byPair.BTCUSDT?.displayName).toBe("BTC/USDT");
    expect(result.serverTime).toBe(1000);
  });

  it("R11 tolerates an empty pair list", () => {
    const result = normalizePairsMeta({ pairs: [], serverTime: 0 });

    expect(result.order).toEqual([]);
    expect(result.byPair).toEqual({});
  });

  it("R11 skips entries with no pair identifier instead of keying on undefined", () => {
    const result = normalizePairsMeta({
      // A malformed entry would otherwise produce a `byPair.undefined` key and
      // an `undefined` in the render order.
      pairs: [meta("BTCUSDT"), { ...meta("X"), pair: "" }],
      serverTime: 0,
    });

    expect(result.order).toEqual(["BTCUSDT"]);
  });

  it("R11 defaults a missing serverTime rather than propagating undefined", () => {
    const result = normalizePairsMeta({
      pairs: [meta("BTCUSDT")],
    } as unknown as Parameters<typeof normalizePairsMeta>[0]);

    expect(result.serverTime).toBe(0);
  });

  it("R11 carries through nulls for a pair with no live data yet", () => {
    const result = normalizePairsMeta({
      pairs: [meta("BTCUSDT", { high24h: null, live: false, status: "UNKNOWN" })],
      serverTime: 0,
    });

    // Null is meaningful: the row renders a placeholder rather than "0.00",
    // which would read as a real price.
    expect(result.byPair.BTCUSDT?.high24h).toBeNull();
    expect(result.byPair.BTCUSDT?.live).toBe(false);
  });
});
