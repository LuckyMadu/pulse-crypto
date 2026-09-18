/**
 * Static per-pair facts that are either genuinely static or that Binance's
 * market-data streams do not carry.
 *
 * Two kinds of data live here and the README is explicit about the difference,
 * because "which numbers are real" is a fair question to ask of a submission
 * that mixes live and mocked data:
 *
 *  - **Genuinely static**: display name, base/quote assets, price decimals.
 *    These belong in code. Fetching `/exchangeInfo` at boot to learn that BTC
 *    quotes to two decimals would add a startup dependency and a failure mode
 *    for a fact that changes approximately never.
 *
 *  - **Mocked**: `circulatingSupply`, used only to derive the market cap the
 *    mockup's ticker block asks for. Binance publishes no supply figure -
 *    market cap is not market data, it is reference data from a different kind
 *    of provider. The brief permits mocked metadata; the alternative was to
 *    omit the field the design asks for, or to pull in CoinGecko for one
 *    cosmetic number.
 *
 * The values also act as the fallback for `GET /pairs/meta` before the first
 * `@ticker` frame lands, so a reviewer who curls the endpoint one second after
 * boot gets a well-formed response with `live: false` rather than nulls.
 */

export interface PairSeed {
  pair: string;
  displayName: string;
  baseAsset: string;
  quoteAsset: string;
  priceDecimals: number;
  /** Mocked. Units of the base asset. `null` where a figure would be a guess. */
  circulatingSupply: number | null;
}

export const PAIR_SEEDS: Record<string, PairSeed> = {
  BTCUSDT: {
    pair: "BTCUSDT",
    displayName: "BTC/USDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    priceDecimals: 2,
    circulatingSupply: 19_780_000,
  },
  ETHUSDT: {
    pair: "ETHUSDT",
    displayName: "ETH/USDT",
    baseAsset: "ETH",
    quoteAsset: "USDT",
    priceDecimals: 2,
    circulatingSupply: 120_400_000,
  },
  SOLUSDT: {
    pair: "SOLUSDT",
    displayName: "SOL/USDT",
    baseAsset: "SOL",
    quoteAsset: "USDT",
    priceDecimals: 2,
    circulatingSupply: 470_000_000,
  },
  DOGEUSDT: {
    pair: "DOGEUSDT",
    displayName: "DOGE/USDT",
    baseAsset: "DOGE",
    quoteAsset: "USDT",
    // DOGE trades around $0.16, so two decimals would render every price as
    // "0.16" and the green/red flash would almost never fire.
    priceDecimals: 5,
    circulatingSupply: 146_000_000_000,
  },
  XRPUSDT: {
    pair: "XRPUSDT",
    displayName: "XRP/USDT",
    baseAsset: "XRP",
    quoteAsset: "USDT",
    priceDecimals: 4,
    circulatingSupply: 56_800_000_000,
  },
};

/**
 * Seed for a pair that is configured but not in the table, so adding a symbol
 * to `PAIRS` works without a code change - it just renders with defaults.
 */
export const fallbackSeed = (pair: string): PairSeed => {
  const quoteAsset = pair.endsWith("USDT") ? "USDT" : pair.slice(-3);
  const baseAsset = pair.slice(0, pair.length - quoteAsset.length);
  return {
    pair,
    displayName: `${baseAsset}/${quoteAsset}`,
    baseAsset,
    quoteAsset,
    priceDecimals: 4,
    circulatingSupply: null,
  };
};

export const getSeed = (pair: string): PairSeed => PAIR_SEEDS[pair] ?? fallbackSeed(pair);
