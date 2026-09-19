/**
 * The gateway's counters, in one place so that `GET /health` and the `stats`
 * WebSocket frame cannot disagree. That matters more than it sounds: the
 * Telemetry screen's whole job is to be believable, and a reviewer who `curl`s
 * `/health` and sees a different ingestion rate than the phone is showing has
 * every reason to distrust both numbers.
 *
 * Rates are sampled rather than computed per event: totals are monotonic
 * counters, and once a second the delta since the last roll becomes the
 * per-second rate. A moving average would be smoother but would also hide the
 * step change when `SYNTHETIC_LOAD` kicks in, which is exactly the moment the
 * recording needs to show.
 */

import { config } from "./config";
import { GatewayStats, UpstreamState } from "./types/protocol";

const startedAt = Date.now();

const totals = {
  upstreamMsgs: 0,
  emits: 0,
  droppedFrames: 0,
  terminatedClients: 0,
};

const lastRoll = {
  at: Date.now(),
  upstreamMsgs: 0,
  emits: 0,
};

const rates = {
  upstreamMsgsPerSec: 0,
  emitsPerSec: 0,
};

let upstreamState: UpstreamState = "connecting";
let emitIntervalMs: number = config.emitIntervalMs;

/**
 * Providers are injected rather than imported to keep this module a leaf.
 * `marketStore` and `clientRegistry` both already depend on `stats`, so
 * importing them back would be a cycle.
 */
let connectedClientsProvider: () => number = () => 0;
let bufferedPairsProvider: () => number = () => 0;

export const stats = {
  recordUpstreamMessages(count = 1): void {
    totals.upstreamMsgs += count;
  },

  recordEmit(): void {
    totals.emits += 1;
  },

  recordDroppedFrame(): void {
    totals.droppedFrames += 1;
  },

  recordTerminatedClient(): void {
    totals.terminatedClients += 1;
  },

  setUpstreamState(state: UpstreamState): void {
    upstreamState = state;
  },

  getUpstreamState(): UpstreamState {
    return upstreamState;
  },

  setEmitIntervalMs(ms: number): void {
    emitIntervalMs = ms;
  },

  /**
   * Partial so the store and the client registry can each contribute the
   * counter they own without clobbering the other's.
   */
  registerProviders(providers: {
    connectedClients?: () => number;
    bufferedPairs?: () => number;
  }): void {
    if (providers.connectedClients) connectedClientsProvider = providers.connectedClients;
    if (providers.bufferedPairs) bufferedPairsProvider = providers.bufferedPairs;
  },

  /** Convert the totals accumulated since the last call into per-second rates. */
  roll(now = Date.now()): void {
    const elapsedSec = (now - lastRoll.at) / 1000;
    if (elapsedSec <= 0) return;

    rates.upstreamMsgsPerSec = Math.round(
      (totals.upstreamMsgs - lastRoll.upstreamMsgs) / elapsedSec,
    );
    rates.emitsPerSec = Math.round((totals.emits - lastRoll.emits) / elapsedSec);

    lastRoll.at = now;
    lastRoll.upstreamMsgs = totals.upstreamMsgs;
    lastRoll.emits = totals.emits;
  },

  snapshot(): GatewayStats {
    const memory = process.memoryUsage();
    return {
      upstreamMsgsPerSec: rates.upstreamMsgsPerSec,
      emitsPerSec: rates.emitsPerSec,
      emitIntervalMs,
      droppedFrames: totals.droppedFrames,
      terminatedClients: totals.terminatedClients,
      connectedClients: connectedClientsProvider(),
      upstream: upstreamState,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      bufferedPairs: bufferedPairsProvider(),
      upstreamMsgsTotal: totals.upstreamMsgs,
      emitsTotal: totals.emits,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    };
  },

  /** Test helper. Production code never resets counters. */
  __resetForTests(): void {
    totals.upstreamMsgs = 0;
    totals.emits = 0;
    totals.droppedFrames = 0;
    totals.terminatedClients = 0;
    lastRoll.at = Date.now();
    lastRoll.upstreamMsgs = 0;
    lastRoll.emits = 0;
    rates.upstreamMsgsPerSec = 0;
    rates.emitsPerSec = 0;
    upstreamState = "connecting";
    emitIntervalMs = config.emitIntervalMs;
  },
};
