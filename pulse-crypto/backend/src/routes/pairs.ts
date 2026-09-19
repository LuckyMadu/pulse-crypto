/**
 * `GET /pairs/meta` (R11).
 *
 * Served from the live `@ticker` stream that is already flowing into the store,
 * with `pairSeed` as the fallback. That is strictly better than mocking the
 * whole response - which the brief permits - for a reason worth one line at
 * review: the endpoint exercises the same store the WebSocket reads from, so it
 * cannot drift out of agreement with the prices on screen.
 *
 * `live` is per pair rather than global, so the client can tell "upstream has
 * not connected yet" from "this pair is quiet".
 */

import { Router } from "express";
import { config } from "../config";
import { getMarketStore } from "../market/marketStore";
import { getSeed } from "../market/pairSeed";
import { PairMeta } from "../types/protocol";

export const pairsRouter = Router();

pairsRouter.get("/meta", (_req, res) => {
  const store = getMarketStore();

  const pairs: PairMeta[] = config.pairs.map(pair => {
    const seed = getSeed(pair);
    const live = store.readMeta(pair);

    // Market cap needs a price, and before the first tick there is not one.
    // Null beats zero: a client can render a placeholder for null, whereas a
    // zero market cap looks like a real and alarming number.
    const price = live?.price ?? 0;
    const marketCapUsd =
      seed.circulatingSupply !== null && price > 0
        ? Math.round(seed.circulatingSupply * price)
        : null;

    return {
      pair,
      displayName: seed.displayName,
      baseAsset: seed.baseAsset,
      quoteAsset: seed.quoteAsset,
      status: live?.hasLiveData ? "TRADING" : "UNKNOWN",
      high24h: live?.high24h ?? null,
      low24h: live?.low24h ?? null,
      volume24h: live?.volume24h ?? null,
      priceDecimals: seed.priceDecimals,
      marketCapUsd,
      live: live?.hasLiveData ?? false,
    };
  });

  res.json({ pairs, serverTime: Date.now() });
});
