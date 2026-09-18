/**
 * The slow-consumer policy (R6).
 *
 * `bufferedAmount` cannot be forced on a real socket from a test - it depends
 * on the kernel draining the peer - so these tests drive a fake that exposes it
 * as a settable field. That is the right seam: the policy under test is the
 * decision logic (skip, count, terminate, forgive), not `ws` itself.
 */

import { WebSocket } from "ws";
import { ClientRegistry } from "../clientRegistry";
import { config } from "../../config";
import { stats } from "../../stats";

/** Minimal stand-in for a `ws` socket, with a writable `bufferedAmount`. */
class FakeSocket {
  // Annotated as `number` rather than inferred: TypeScript would otherwise
  // narrow it to the literal `1` and reject assigning CLOSING or CLOSED.
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  sent: string[] = [];
  terminated = false;
  pings = 0;

  private handlers = new Map<string, ((...args: unknown[]) => void)[]>();

  send(data: string): void {
    this.sent.push(data);
  }

  terminate(): void {
    this.terminated = true;
    this.readyState = WebSocket.CLOSED;
  }

  ping(): void {
    this.pings += 1;
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
  }

  on(event: string, handler: (...args: unknown[]) => void): this {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
}

const asSocket = (fake: FakeSocket): WebSocket => fake as unknown as WebSocket;

const overBudget = config.backpressure.maxBufferedBytes + 1;

beforeEach(() => {
  stats.__resetForTests();
});

describe("R6 backpressure guard", () => {
  it("R6 sends normally while the client is draining", () => {
    const registry = new ClientRegistry();
    const fake = new FakeSocket();
    const client = registry.add(asSocket(fake));

    expect(registry.send(client, "frame-1")).toBe(true);
    expect(fake.sent).toEqual(["frame-1"]);
    expect(stats.snapshot().droppedFrames).toBe(0);
  });

  it("R6 skips the frame instead of queueing it when over the send budget", () => {
    const registry = new ClientRegistry();
    const fake = new FakeSocket();
    const client = registry.add(asSocket(fake));

    fake.bufferedAmount = overBudget;

    expect(registry.send(client, "frame")).toBe(false);
    // Nothing was written, so nothing accumulated in the process. This is the
    // whole point: the alternative is calling send() anyway and growing the
    // socket's buffer without limit.
    expect(fake.sent).toEqual([]);
    expect(stats.snapshot().droppedFrames).toBe(1);
  });

  it("R6 terminates a client that stays over budget for the configured run of ticks", () => {
    const registry = new ClientRegistry();
    const fake = new FakeSocket();
    const client = registry.add(asSocket(fake));

    fake.bufferedAmount = overBudget;

    for (let tick = 0; tick < config.backpressure.maxConsecutiveSkips - 1; tick += 1) {
      registry.send(client, "frame");
    }
    // One short of the threshold: still tolerated, still connected.
    expect(fake.terminated).toBe(false);
    expect(registry.size).toBe(1);

    registry.send(client, "frame");

    expect(fake.terminated).toBe(true);
    // Removed from the registry too, so the next tick does not even consider it
    // and the buffer is released.
    expect(registry.size).toBe(0);
    expect(stats.snapshot().terminatedClients).toBe(1);
  });

  it("R6 forgives earlier skips once the client drains again", () => {
    const registry = new ClientRegistry();
    const fake = new FakeSocket();
    const client = registry.add(asSocket(fake));

    fake.bufferedAmount = overBudget;
    for (let tick = 0; tick < config.backpressure.maxConsecutiveSkips - 1; tick += 1) {
      registry.send(client, "frame");
    }

    // The client catches up.
    fake.bufferedAmount = 0;
    registry.send(client, "recovered");

    // ...and is back to a clean slate. Without the reset, a client that
    // hiccuped 49 times over an hour would be killed by an unrelated 50th,
    // which is not what "sustained backpressure" means.
    expect(client.consecutiveSkips).toBe(0);

    fake.bufferedAmount = overBudget;
    for (let tick = 0; tick < config.backpressure.maxConsecutiveSkips - 1; tick += 1) {
      registry.send(client, "frame");
    }
    expect(fake.terminated).toBe(false);
  });

  it("R6 does not write to a socket that is no longer open", () => {
    const registry = new ClientRegistry();
    const fake = new FakeSocket();
    const client = registry.add(asSocket(fake));

    fake.readyState = WebSocket.CLOSING;

    expect(registry.send(client, "frame")).toBe(false);
    expect(fake.sent).toEqual([]);
    // Not counted as a dropped frame: the client left, it is not lagging.
    expect(stats.snapshot().droppedFrames).toBe(0);
  });
});

describe("R6 serialization sharing", () => {
  it("R6 groups clients with identical depth subscriptions so each payload is built once", () => {
    const registry = new ClientRegistry();

    const watchlistA = new FakeSocket();
    const watchlistB = new FakeSocket();
    const detailBtc = new FakeSocket();
    const detailEth = new FakeSocket();

    registry.add(asSocket(watchlistA));
    registry.add(asSocket(watchlistB));
    registry.add(asSocket(detailBtc));
    registry.add(asSocket(detailEth));

    registry.setDepthSubscription(asSocket(detailBtc), ["BTCUSDT"]);
    registry.setDepthSubscription(asSocket(detailEth), ["ETHUSDT"]);

    const groups = registry.groupBySubscription();

    // Four clients, three distinct payloads. Serialization cost tracks
    // subscription variety, not client count.
    expect(groups.size).toBe(3);
    expect(groups.get("")).toHaveLength(2);
    expect(groups.get("BTCUSDT")).toHaveLength(1);
  });

  it("R6 treats subscription sets as unordered", () => {
    const registry = new ClientRegistry();
    const first = new FakeSocket();
    const second = new FakeSocket();

    registry.add(asSocket(first));
    registry.add(asSocket(second));
    registry.setDepthSubscription(asSocket(first), ["BTCUSDT", "ETHUSDT"]);
    registry.setDepthSubscription(asSocket(second), ["ETHUSDT", "BTCUSDT"]);

    // Otherwise the same payload would be serialized twice for no reason.
    expect(registry.groupBySubscription().size).toBe(1);
  });

  it("R10 replaces a depth subscription rather than accumulating it", () => {
    const registry = new ClientRegistry();
    const fake = new FakeSocket();
    registry.add(asSocket(fake));

    registry.setDepthSubscription(asSocket(fake), ["BTCUSDT"]);
    const after = registry.setDepthSubscription(asSocket(fake), ["ETHUSDT"]);

    // Navigating from BTC's detail screen to ETH's must not leave the client
    // subscribed to a book it no longer renders.
    expect([...after]).toEqual(["ETHUSDT"]);
  });
});

describe("R32 heartbeat", () => {
  it("R32 reaps a client that never answers a ping", () => {
    jest.useFakeTimers();
    const registry = new ClientRegistry();
    const fake = new FakeSocket();
    registry.add(asSocket(fake));

    registry.startHeartbeat();

    // First sweep: pings and marks the client unproven.
    jest.advanceTimersByTime(config.backpressure.heartbeatIntervalMs);
    expect(fake.pings).toBe(1);
    expect(registry.size).toBe(1);

    // Second sweep with no pong in between: the socket is half-open. A `close`
    // event would never have fired here, which is exactly why the heartbeat
    // exists rather than relying on close alone.
    jest.advanceTimersByTime(config.backpressure.heartbeatIntervalMs);
    expect(fake.terminated).toBe(true);
    expect(registry.size).toBe(0);

    registry.stopHeartbeat();
    jest.useRealTimers();
  });

  it("R32 keeps a client that answers", () => {
    jest.useFakeTimers();
    const registry = new ClientRegistry();
    const fake = new FakeSocket();
    registry.add(asSocket(fake));
    registry.startHeartbeat();

    jest.advanceTimersByTime(config.backpressure.heartbeatIntervalMs);
    fake.emit("pong");
    jest.advanceTimersByTime(config.backpressure.heartbeatIntervalMs);

    expect(fake.terminated).toBe(false);
    expect(registry.size).toBe(1);

    registry.stopHeartbeat();
    jest.useRealTimers();
  });
});
