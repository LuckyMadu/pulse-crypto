/**
 * The flush timer (R5).
 *
 * The interesting assertions here are about what is *not* sent: idle ticks, and
 * fields that did not move.
 */

import { WebSocket } from "ws";
import { Emitter } from "../emitter";
import { MarketStore } from "../marketStore";
import { ClientRegistry } from "../../ws/clientRegistry";
import { EMIT_INTERVAL_MAX_MS, EMIT_INTERVAL_MIN_MS } from "../../config";
import { ServerMessage } from "../../types/protocol";

class FakeSocket {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }
  terminate(): void {}
  ping(): void {}
  close(): void {}
  on(): this {
    return this;
  }

  /** Parsed frames, excluding the control frames sent on connect. */
  updates(): ServerMessage[] {
    return this.sent.map(raw => JSON.parse(raw) as ServerMessage);
  }
}

const asSocket = (fake: FakeSocket): WebSocket => fake as unknown as WebSocket;

const PAIRS = ["BTCUSDT", "ETHUSDT"] as const;

const setup = () => {
  const store = new MarketStore(PAIRS);
  const registry = new ClientRegistry();
  const emitter = new Emitter({ store, registry, intervalMs: 100 });
  return { store, registry, emitter };
};

describe("R5 flush behaviour", () => {
  it("R5 sends nothing when no pair has changed", () => {
    const { registry, emitter } = setup();
    const fake = new FakeSocket();
    registry.add(asSocket(fake));

    emitter.flush();

    // No keepalive, no empty array. During a quiet market this is most ticks,
    // and the heartbeat already proves liveness.
    expect(fake.sent).toEqual([]);
  });

  it("R5 batches every changed pair into a single frame", () => {
    const { store, registry, emitter } = setup();
    const fake = new FakeSocket();
    registry.add(asSocket(fake));

    store.applyBookTicker("BTCUSDT", { bestBid: 100, bestAsk: 101 });
    store.applyBookTicker("ETHUSDT", { bestBid: 200, bestAsk: 201 });
    emitter.flush();

    // One frame for two pairs, not one frame each. At five pairs and 10 Hz that
    // is 10 frames/s instead of 50.
    expect(fake.sent).toHaveLength(1);
    const message = fake.updates()[0];
    expect(message?.type).toBe("update");
    expect(message?.type === "update" && message.pairs).toHaveLength(2);
  });

  it("R5 omits pairs that did not change from the frame", () => {
    const { store, registry, emitter } = setup();
    const fake = new FakeSocket();
    registry.add(asSocket(fake));

    store.applyBookTicker("BTCUSDT", { bestBid: 100, bestAsk: 101 });
    emitter.flush();

    const message = fake.updates()[0];
    expect(message?.type === "update" && message.pairs.map(pair => pair.pair)).toEqual([
      "BTCUSDT",
    ]);
  });

  it("R5 collapses a burst of upstream messages into one emitted frame", () => {
    const { store, registry, emitter } = setup();
    const fake = new FakeSocket();
    registry.add(asSocket(fake));

    for (let index = 0; index < 1_000; index += 1) {
      store.applyBookTicker("BTCUSDT", { bestBid: 100 + index, bestAsk: 101 + index });
    }
    emitter.flush();

    // 1,000 in, 1 out, carrying the newest value - the mid of the final
    // message (bid 1099, ask 1100). This is the conflation ratio the Telemetry
    // screen puts on screen.
    expect(fake.sent).toHaveLength(1);
    const message = fake.updates()[0];
    const btc = message?.type === "update" ? message.pairs[0] : undefined;
    expect(btc?.price).toBe(1_099.5);
  });

  it("R5 clears dirty flags after every subscription group is served", () => {
    const { store, registry, emitter } = setup();

    const watchlist = new FakeSocket();
    const detail = new FakeSocket();
    registry.add(asSocket(watchlist));
    registry.add(asSocket(detail));
    registry.setDepthSubscription(asSocket(detail), ["BTCUSDT"]);

    store.applyDepth("BTCUSDT", { bids: [[100, 1]], asks: [[101, 1]] });
    emitter.flush();

    // The regression this guards: clearing flags inside the group loop would
    // leave whichever group was served second with an empty payload.
    expect(watchlist.sent).toHaveLength(1);
    expect(detail.sent).toHaveLength(1);

    const watchlistUpdate = watchlist.updates()[0];
    const detailUpdate = detail.updates()[0];
    const watchlistPair =
      watchlistUpdate?.type === "update" ? watchlistUpdate.pairs[0] : undefined;
    const detailPair = detailUpdate?.type === "update" ? detailUpdate.pairs[0] : undefined;

    expect(watchlistPair?.book).toBeUndefined();
    expect(detailPair?.book).toEqual({ bids: [[100, 1]], asks: [[101, 1]] });
  });

  it("R5 clears flags even with no clients attached", () => {
    const { store, emitter } = setup();

    store.applyBookTicker("BTCUSDT", { bestBid: 100, bestAsk: 101 });
    emitter.flush();

    // Otherwise the first client to connect would receive a stale "changed" set
    // describing movement from before it existed.
    expect(store.project("BTCUSDT", true, false)?.price).toBeUndefined();
  });
});

describe("R5 configurable interval", () => {
  it("R5 defaults to the interval the brief specifies", () => {
    const store = new MarketStore(PAIRS);
    const registry = new ClientRegistry();

    // The mockup's slider reads 250ms; the brief says 100ms and the brief wins.
    expect(new Emitter({ store, registry }).currentIntervalMs).toBe(100);
  });

  it("R5 applies an in-range interval from the Update Frequency slider", () => {
    const { emitter } = setup();

    expect(emitter.setIntervalMs(500)).toBe(500);
    expect(emitter.currentIntervalMs).toBe(500);
  });

  it("R5 clamps out-of-range requests rather than trusting the client", () => {
    const { emitter } = setup();

    // A slider can only send 10-1000, but the socket is open to anyone.
    // Accepting 0 would spin the event loop; accepting 1e9 would stop the app.
    expect(emitter.setIntervalMs(0)).toBe(EMIT_INTERVAL_MIN_MS);
    expect(emitter.setIntervalMs(9_999)).toBe(EMIT_INTERVAL_MAX_MS);
    expect(emitter.setIntervalMs(-5)).toBe(EMIT_INTERVAL_MIN_MS);
  });

  it("R5 keeps flushing at the new cadence after a retune", () => {
    jest.useFakeTimers();
    const { store, registry, emitter } = setup();
    const fake = new FakeSocket();
    registry.add(asSocket(fake));

    emitter.start();
    emitter.setIntervalMs(200);

    store.applyBookTicker("BTCUSDT", { bestBid: 100, bestAsk: 101 });
    jest.advanceTimersByTime(200);

    // Guards the bug where restarting the timer drops the interval change, or
    // leaves the old timer running alongside the new one.
    expect(fake.sent).toHaveLength(1);

    emitter.stop();
    jest.useRealTimers();
  });
});

describe("R6 emitter respects backpressure", () => {
  it("R6 skips a lagging client without affecting a healthy one", () => {
    const { store, registry, emitter } = setup();

    const healthy = new FakeSocket();
    const lagging = new FakeSocket();
    registry.add(asSocket(healthy));
    registry.add(asSocket(lagging));
    lagging.bufferedAmount = 64 * 1024 * 1024;

    store.applyBookTicker("BTCUSDT", { bestBid: 100, bestAsk: 101 });
    emitter.flush();

    // One slow consumer must not degrade anyone else's stream - which holds
    // because the payload was already serialized once for the group.
    expect(healthy.sent).toHaveLength(1);
    expect(lagging.sent).toEqual([]);
  });
});
