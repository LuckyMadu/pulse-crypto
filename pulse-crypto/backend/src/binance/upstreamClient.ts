/**
 * Stage 1 of the pipeline: one WebSocket to Binance, feeding the store (R2, R3).
 *
 * The reconnect logic is the interesting part. Three things it gets right that
 * a naive `socket.on("close", connect)` does not:
 *
 *  1. **Exponential backoff with jitter.** Without backoff, a Binance outage
 *     turns into a tight reconnect loop. Without jitter, every instance of the
 *     service retries in lockstep and hammers the endpoint in synchronised
 *     waves the moment it recovers.
 *
 *  2. **A stall timeout, not just a close event.** The failure that actually
 *     happens in production is not a clean close, it is a socket that stays
 *     open and stops delivering. Binance also closes idle connections at 24h.
 *     So a watchdog tears down the socket if no frame arrives for
 *     `stallTimeoutMs`, which converts a silent hang into a reconnect.
 *
 *  3. **The store is never cleared on disconnect.** Last-known prices stay
 *     served while upstream is down, which is what lets the mobile app satisfy
 *     R25 - and it is free, because the store is keyed by pair rather than
 *     being a replayable log.
 */

import { WebSocket } from "ws";
import { config } from "../config";
import { MarketStore } from "../market/marketStore";
import { stats } from "../stats";
import { UpstreamState } from "../types/protocol";
import { logger } from "../utils/logger";
import { decodeFrame } from "../utils/wsFrame";
import { buildStreamPath, normalizeFrame } from "./normalize";

export interface UpstreamClientOptions {
  store: MarketStore;
  onStateChange?: (state: UpstreamState) => void;
}

export class UpstreamClient {
  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stallTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  private readonly store: MarketStore;
  private readonly knownPairs: ReadonlySet<string>;
  private readonly url: string;
  private readonly onStateChange: (state: UpstreamState) => void;

  constructor({ store, onStateChange }: UpstreamClientOptions) {
    this.store = store;
    this.knownPairs = new Set(store.pairs());
    this.url = `wss://${config.upstream.host}${buildStreamPath(
      store.pairs(),
      config.upstream.depthLevels,
    )}`;
    this.onStateChange = onStateChange ?? (() => undefined);
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    // `close()` rather than `terminate()` so the FIN is sent and Binance is not
    // left holding a half-open connection on our behalf.
    this.socket?.close();
    this.socket = null;
  }

  private setState(state: UpstreamState): void {
    stats.setUpstreamState(state);
    this.onStateChange(state);
  }

  private connect(): void {
    if (this.stopped) return;

    logger.info(
      `[upstream] connecting to ${config.upstream.host} for ${this.knownPairs.size} pairs`,
    );
    this.setState(this.reconnectAttempt === 0 ? "connecting" : "reconnecting");

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.on("open", () => {
      logger.info("[upstream] connected");
      this.reconnectAttempt = 0;
      this.setState("connected");
      this.armStallTimer();
    });

    socket.on("message", data => {
      this.armStallTimer();
      stats.recordUpstreamMessages();
      this.handleFrame(decodeFrame(data));
    });

    // A socket-level error is always followed by `close`, so reconnecting is
    // handled in one place rather than raced between the two handlers.
    socket.on("error", error => {
      logger.warn("[upstream] socket error", { message: error.message });
    });

    socket.on("close", (code, reason) => {
      if (this.stopped) return;
      logger.warn("[upstream] closed", { code, reason: reason.toString() });
      this.scheduleReconnect();
    });
  }

  private handleFrame(raw: string): void {
    const frame = normalizeFrame(raw, {
      depthLevels: config.upstream.depthLevels,
      knownPairs: this.knownPairs,
    });
    if (!frame) return;

    switch (frame.kind) {
      case "depth":
        this.store.applyDepth(frame.pair, frame.payload);
        break;
      case "bookTicker":
        this.store.applyBookTicker(frame.pair, frame.payload);
        break;
      case "ticker":
        this.store.applyTicker(frame.pair, frame.payload);
        break;
    }
  }

  /**
   * Restart the silence watchdog. Called on every frame, so it only fires when
   * the stream has genuinely gone quiet.
   */
  private armStallTimer(): void {
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.stallTimer = setTimeout(() => {
      logger.warn(
        `[upstream] no frames for ${config.upstream.stallTimeoutMs}ms, forcing reconnect`,
      );
      // `terminate()`, not `close()`: a stalled socket may never complete a
      // closing handshake, and waiting for one would extend the outage.
      this.socket?.terminate();
    }, config.upstream.stallTimeoutMs);
  }

  private scheduleReconnect(): void {
    this.clearTimers();

    const { reconnectBaseMs, reconnectMaxMs } = config.upstream;
    const exponential = Math.min(
      reconnectMaxMs,
      reconnectBaseMs * 2 ** this.reconnectAttempt,
    );
    // Full jitter: a uniform draw from [0, exponential] rather than
    // `exponential ± small`. It de-synchronises retries far better, at the cost
    // of the occasional very short wait, which is harmless here.
    const delay = Math.round(Math.random() * exponential);

    this.reconnectAttempt += 1;
    this.setState("reconnecting");
    logger.info(
      `[upstream] reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`,
    );

    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }
}
