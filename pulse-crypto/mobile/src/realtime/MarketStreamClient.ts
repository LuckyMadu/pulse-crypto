/**
 * The app's connection to the gateway (R19, R24, R26, R32).
 *
 * Four things this handles that a bare `new WebSocket(url)` does not:
 *
 *  1. **Exponential backoff with jitter.** A gateway that is down should not be
 *     hammered, and every client should not retry in lockstep.
 *
 *  2. **App state.** A backgrounded app cannot render, so holding the socket
 *     open only drains battery and - from the gateway's point of view - makes
 *     this client look like a slow consumer, since iOS and Android both stop
 *     draining the socket well before they suspend the process. Dropping on
 *     background and reconnecting on foreground is both cheaper and kinder to
 *     the server's backpressure budget.
 *
 *  3. **Connectivity.** NetInfo tells us the radio is down before the socket
 *     times out, which turns a 10-second silent stall into an immediate,
 *     accurate "offline".
 *
 *  4. **A stall timeout.** The gateway sends a `stats` frame every second, so
 *     silence is unambiguous evidence of a dead connection even when the socket
 *     still reports itself open. This is the failure that actually happens on
 *     mobile networks, and no `close` event ever fires for it.
 *
 * The store is never cleared here. See `marketStore.ts` - there is no method
 * to do it, by design (R25).
 */

import { AppState, AppStateStatus, NativeEventSubscription } from "react-native";
import NetInfo, { NetInfoSubscription } from "@react-native-community/netinfo";
import { config } from "@config";
import { ClientMessage, ServerMessage } from "@protocol";
import { logger } from "@utils";
import { MarketStore } from "./marketStore";

export class MarketStreamClient {
  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;

  private appStateSub: NativeEventSubscription | null = null;
  private netInfoSub: NetInfoSubscription | null = null;

  private started = false;
  private isForeground = true;
  private isOnline = true;

  /**
   * Remembered across reconnects so the detail screen does not have to
   * re-subscribe itself after an outage it never saw.
   */
  private depthPairs: string[] = [];

  constructor(private readonly store: MarketStore) {}

  start(): void {
    if (this.started) return;
    this.started = true;

    this.appStateSub = AppState.addEventListener("change", this.handleAppStateChange);
    this.netInfoSub = NetInfo.addEventListener(state => {
      const online = state.isConnected !== false;
      if (online === this.isOnline) return;
      this.isOnline = online;

      if (!online) {
        logger.info("[stream] connectivity lost");
        // Timers first. A stall timer left armed would fire seconds later and
        // overwrite "offline" with "reconnecting", which is both wrong and the
        // more alarming of the two messages.
        this.clearTimers();
        this.store.setStatus("offline");
        this.teardownSocket();
      } else {
        logger.info("[stream] connectivity restored");
        // Reset the backoff: this is a fresh opportunity, not a continuation of
        // the previous failure sequence, so making the user wait out an
        // accumulated 15-second delay would be wrong.
        this.reconnectAttempt = 0;
        this.connect();
      }
    });

    this.connect();
  }

  stop(): void {
    this.started = false;
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.netInfoSub?.();
    this.netInfoSub = null;
    this.clearTimers();
    this.teardownSocket();
  }

  /**
   * Ask the gateway for order book depth on these pairs (R18).
   *
   * Sent immediately if connected and replayed on every subsequent reconnect.
   */
  subscribeDepth(pairs: string[]): void {
    this.depthPairs = pairs;
    this.send({ type: "subscribeDepth", pairs });
  }

  /** Retune the gateway's emit interval from the Telemetry slider (R5). */
  setEmitInterval(ms: number): void {
    this.send({ type: "setEmitInterval", ms });
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  private handleAppStateChange = (next: AppStateStatus): void => {
    const foreground = next === "active";
    if (foreground === this.isForeground) return;
    this.isForeground = foreground;

    if (!foreground) {
      logger.debug("[stream] backgrounded, closing socket");
      this.clearTimers();
      this.teardownSocket();
      return;
    }

    logger.debug("[stream] foregrounded, reconnecting");
    this.reconnectAttempt = 0;
    this.connect();
  };

  private connect(): void {
    if (!this.started || !this.isForeground || !this.isOnline) return;
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.store.setStatus(this.reconnectAttempt === 0 ? "connecting" : "reconnecting");
    logger.debug(`[stream] connecting to ${config.stream.url}`);

    const socket = new WebSocket(config.stream.url);
    this.socket = socket;

    socket.onopen = () => {
      logger.info("[stream] connected");
      this.reconnectAttempt = 0;
      this.store.setStatus("live");
      this.armStallTimer();

      // Replay the subscription the UI established before the outage.
      if (this.depthPairs.length > 0) {
        this.send({ type: "subscribeDepth", pairs: this.depthPairs });
      }
    };

    socket.onmessage = event => {
      this.armStallTimer();
      this.handleMessage(String(event.data));
    };

    socket.onerror = () => {
      // React Native's WebSocket error event carries no useful detail, and
      // `onclose` always follows, so reconnect logic lives in one place.
      logger.debug("[stream] socket error");
    };

    socket.onclose = () => {
      if (this.socket !== socket) return; // superseded by a newer socket
      this.socket = null;
      if (!this.started || !this.isForeground) return;
      this.scheduleReconnect();
    };
  }

  private handleMessage(raw: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      logger.warn("[stream] dropped unparseable frame");
      return;
    }

    switch (message.type) {
      case "snapshot":
        this.store.setPairOrder(message.pairs.map(pair => pair.pair));
        this.store.applyUpdates(message.pairs);
        break;
      case "update":
        this.store.applyUpdates(message.pairs);
        break;
      case "status":
        this.store.setUpstream(message.upstream);
        break;
      case "stats":
        this.store.setStats(message.stats);
        break;
      case "config":
        this.store.setEmitIntervalMs(message.emitIntervalMs);
        break;
      case "error":
        logger.warn(`[stream] gateway rejected a message: ${message.message}`);
        break;
    }
  }

  private armStallTimer(): void {
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.stallTimer = setTimeout(() => {
      logger.warn("[stream] no frames received, treating connection as dead");
      // Close rather than wait: the socket believes it is open, so nothing else
      // will ever fire.
      this.teardownSocket();
      this.scheduleReconnect();
    }, config.stream.stallTimeoutMs);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    // Nothing to retry against while the radio is down or the app is in the
    // background; those two paths reconnect themselves when they recover.
    if (!this.started || !this.isForeground || !this.isOnline) return;

    const { reconnectBaseMs, reconnectMaxMs } = config.stream;
    const exponential = Math.min(reconnectMaxMs, reconnectBaseMs * 2 ** this.reconnectAttempt);
    const delay = Math.round(Math.random() * exponential);

    this.reconnectAttempt += 1;
    this.store.setStatus("reconnecting");
    logger.debug(`[stream] reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private teardownSocket(): void {
    if (!this.socket) return;
    // Detach handlers before closing so the `onclose` above does not schedule a
    // reconnect for a socket we are deliberately discarding.
    this.socket.onopen = null;
    this.socket.onmessage = null;
    this.socket.onerror = null;
    this.socket.onclose = null;
    this.socket.close();
    this.socket = null;
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
