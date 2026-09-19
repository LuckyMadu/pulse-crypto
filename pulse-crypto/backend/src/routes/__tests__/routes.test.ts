/**
 * The REST surface (R11, R33).
 *
 * Driven through `supertest` against the app object returned by `createApp()`,
 * with no port binding - which is the payoff of the `app.ts` / `server.ts`
 * split. Test files cannot collide on a port and cannot leak an open handle
 * that keeps Jest running after the suite passes.
 */

import request from "supertest";
import { createApp } from "../../app";
import { config } from "../../config";
import { __resetMarketStoreForTests, getMarketStore } from "../../market/marketStore";
import { PairMeta } from "../../types/protocol";

interface MetaResponse {
  pairs: PairMeta[];
  serverTime: number;
}

beforeEach(() => {
  __resetMarketStoreForTests();
  getMarketStore(config.pairs);
});

describe("R11 GET /pairs/meta", () => {
  it("R11 returns every configured pair", async () => {
    const response = await request(createApp()).get("/pairs/meta").expect(200);
    const body = response.body as MetaResponse;

    expect(body.pairs.map(pair => pair.pair)).toEqual([...config.pairs]);
  });

  it("R11 serves a well-formed response before upstream has connected", async () => {
    const response = await request(createApp()).get("/pairs/meta").expect(200);
    const btc = (response.body as MetaResponse).pairs[0];

    // A reviewer curling this one second after boot gets usable structure with
    // an honest `live: false`, not nulls or a 503.
    expect(btc?.displayName).toBe("BTC/USDT");
    expect(btc?.priceDecimals).toBe(2);
    expect(btc?.live).toBe(false);
    expect(btc?.status).toBe("UNKNOWN");
    expect(btc?.high24h).toBeNull();
  });

  it("R11 reports live 24h statistics once the ticker stream has landed", async () => {
    getMarketStore().applyTicker("BTCUSDT", {
      price: 64_000,
      high24h: 65_000,
      low24h: 63_000,
      volume24h: 12_345,
    });

    const response = await request(createApp()).get("/pairs/meta").expect(200);
    const btc = (response.body as MetaResponse).pairs.find(pair => pair.pair === "BTCUSDT");

    expect(btc?.high24h).toBe(65_000);
    expect(btc?.low24h).toBe(63_000);
    expect(btc?.volume24h).toBe(12_345);
    expect(btc?.status).toBe("TRADING");
    expect(btc?.live).toBe(true);
  });

  it("R11 derives market cap from the mocked supply table once a price exists", async () => {
    getMarketStore().applyTicker("BTCUSDT", { price: 64_000 });

    const response = await request(createApp()).get("/pairs/meta").expect(200);
    const pairs = (response.body as MetaResponse).pairs;

    const btc = pairs.find(pair => pair.pair === "BTCUSDT");
    const eth = pairs.find(pair => pair.pair === "ETHUSDT");

    expect(btc?.marketCapUsd).toBe(19_780_000 * 64_000);
    // Null rather than zero for a pair with no price yet: a client can render a
    // placeholder for null, whereas a zero market cap reads as a real number.
    expect(eth?.marketCapUsd).toBeNull();
  });
});

describe("GET /health", () => {
  it("reports degraded while upstream is still connecting", async () => {
    const response = await request(createApp()).get("/health").expect(200);
    const body = response.body as { status: string; stats: { bufferedPairs: number } };

    expect(body.status).toBe("degraded");
    // The memory bound, visible over curl.
    expect(body.stats.bufferedPairs).toBe(config.pairs.length);
  });

  it("R6 exposes the backpressure configuration it is enforcing", async () => {
    const response = await request(createApp()).get("/health").expect(200);
    const body = response.body as {
      config: { maxBufferedBytes: number; maxConsecutiveSkips: number };
    };

    expect(body.config.maxBufferedBytes).toBe(config.backpressure.maxBufferedBytes);
    expect(body.config.maxConsecutiveSkips).toBe(config.backpressure.maxConsecutiveSkips);
  });
});

describe("R33 error handling", () => {
  it("R33 answers an unknown route with the standard error shape", async () => {
    const response = await request(createApp()).get("/nope").expect(404);

    expect(response.body).toEqual({
      error: "not_found",
      message: "GET /nope is not a route on this gateway",
    });
  });
});
