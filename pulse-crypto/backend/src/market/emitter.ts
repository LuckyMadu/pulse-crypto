/**
 * Stage 2b: the flush timer (R5).
 *
 * One `setInterval` for the whole process, not one per client. That is the
 * decision that makes the emit rate a property of the *server* rather than of
 * how many phones are attached, and it is why the Telemetry screen's "emit
 * rate" is a meaningful number: it stays at 10/s whether ingest is at 40 msg/s
 * or 4000, and whether there is one client or fifty.
 *
 * ## Cost per tick
 *
 * For each distinct depth-subscription group:
 *   1. project the dirty pairs onto the wire format
 *   2. `JSON.stringify` **once**
 *   3. hand that one string to every client in the group
 *
 * So serialization is O(subscription groups), not O(clients). In the demo that
 * is two groups - the watchlist and the one open detail screen - however many
 * clients are connected. Serializing per client is the mistake this avoids;
 * it is invisible at one client and quadratic-feeling at fifty.
 *
 * ## Why it is safe to skip a tick entirely
 *
 * If nothing is dirty, nothing is sent. No keepalive frame, no empty array. The
 * heartbeat in `clientRegistry` already proves liveness, so an empty update
 * would be bytes that carry no information - and during a quiet market that is
 * most ticks.
 */

import { ClientRegistry } from "../ws/clientRegistry";
import { EMIT_INTERVAL_MAX_MS, EMIT_INTERVAL_MIN_MS, config } from "../config";
import { MarketStore } from "./marketStore";
import { stats } from "../stats";
import { PairUpdate, ServerMessage } from "../types/protocol";
import { logger } from "../utils/logger";

export interface EmitterOptions {
  store: MarketStore;
  registry: ClientRegistry;
  intervalMs?: number;
}

export class Emitter {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;

  private readonly store: MarketStore;
  private readonly registry: ClientRegistry;

  constructor({ store, registry, intervalMs }: EmitterOptions) {
    this.store = store;
    this.registry = registry;
    this.intervalMs = intervalMs ?? config.emitIntervalMs;
    stats.setEmitIntervalMs(this.intervalMs);
  }

  get currentIntervalMs(): number {
    return this.intervalMs;
  }

  start(): void {
    this.stop();
    this.timer = setInterval(() => this.flush(), this.intervalMs);
    logger.info(`[emitter] flushing every ${this.intervalMs}ms`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Retune the interval at runtime, driven by the mockup's Update Frequency
   * slider (R5).
   *
   * This is a **global** control, not per-client: it retunes the one shared
   * timer. A per-client cadence would mean a timer and an independent dirty-set
   * view per socket, which buys nothing for a demo and costs the single-timer
   * property that makes the emit rate legible in the first place. Documented as
   * an assumption in the README.
   *
   * @returns the interval actually applied, after clamping.
   */
  setIntervalMs(requestedMs: number): number {
    const clamped = Math.min(
      EMIT_INTERVAL_MAX_MS,
      Math.max(EMIT_INTERVAL_MIN_MS, Math.round(requestedMs)),
    );

    if (clamped === this.intervalMs) return clamped;

    this.intervalMs = clamped;
    stats.setEmitIntervalMs(clamped);
    if (this.timer) this.start();

    logger.info(`[emitter] interval retuned to ${clamped}ms`);
    return clamped;
  }

  /**
   * One flush. Exposed rather than private so the tests can step the pipeline
   * deterministically instead of sleeping on a real timer.
   */
  flush(): void {
    const dirtyPairs = this.store.drainDirty();
    if (dirtyPairs.length === 0) return;

    // Counted here rather than after a successful send, so the rate measures
    // the emitter's cadence rather than the client population. That is what
    // makes it comparable against the ingestion rate: `curl /health` with no
    // app attached still shows 10 emits/s against 2000 ingests/s, which is the
    // conflation ratio the whole design exists to produce.
    stats.recordEmit();

    const groups = this.registry.groupBySubscription();
    if (groups.size === 0) {
      // Nobody is listening, but the flags must still be cleared or the first
      // client to connect would receive a stale "changed" set.
      this.store.clearFieldFlags(dirtyPairs);
      return;
    }

    const serverTime = Date.now();

    for (const [key, clients] of groups) {
      const subscribed = key === "" ? null : new Set(key.split(","));

      const updates: PairUpdate[] = [];
      for (const pair of dirtyPairs) {
        const update = this.store.project(
          pair,
          true,
          subscribed?.has(pair) ?? false,
        );
        // A pair can be dirty on `timestamp` alone if every changed field was
        // already at its new value; sending a bare timestamp is noise.
        if (update && hasPayload(update)) updates.push(update);
      }

      if (updates.length === 0) continue;

      const message: ServerMessage = { type: "update", serverTime, pairs: updates };
      const serialized = JSON.stringify(message);

      for (const client of clients) {
        this.registry.send(client, serialized);
      }
    }

    // After every group has been projected, never inside the loop - clearing
    // early would leave the second group with an empty payload.
    this.store.clearFieldFlags(dirtyPairs);
  }
}

/** True if the update carries anything beyond its identity and timestamp. */
const hasPayload = (update: PairUpdate): boolean =>
  update.price !== undefined ||
  update.change24hPct !== undefined ||
  update.spread !== undefined ||
  update.buyPressure !== undefined ||
  update.book !== undefined;
