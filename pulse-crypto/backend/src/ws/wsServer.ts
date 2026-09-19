/**
 * Stage 3b: the local WebSocket server the mobile app talks to (R8).
 *
 * Connection lifecycle, in order:
 *
 *  1. Register the client.
 *  2. Send a **full snapshot** immediately, then `status`, then `config`.
 *     The snapshot matters for R12 and R25: a client that connected mid-session
 *     must paint current prices at once rather than waiting for each pair to
 *     tick, and during a quiet market that wait could be seconds. Subsequent
 *     frames are changed-fields-only, so snapshot-then-deltas is also the
 *     cheapest correct sequence.
 *  3. From then on the shared emitter drives everything.
 *
 * Inbound messages are the only untrusted input the gateway accepts, so they go
 * through `isClientMessage` before use and every handler is wrapped - a
 * malformed frame from one client must not take down the server for the others
 * (R33).
 */

import { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { Emitter } from "../market/emitter";
import { MarketStore } from "../market/marketStore";
import { stats } from "../stats";
import { ServerMessage, UpstreamState, isClientMessage } from "../types/protocol";
import { logger } from "../utils/logger";
import { decodeFrame } from "../utils/wsFrame";
import { ClientRegistry } from "./clientRegistry";
import { config } from "../config";

export interface WsServerOptions {
  httpServer: HttpServer;
  store: MarketStore;
  registry: ClientRegistry;
  emitter: Emitter;
}

export class MarketWsServer {
  private readonly wss: WebSocketServer;
  private readonly store: MarketStore;
  private readonly registry: ClientRegistry;
  private readonly emitter: Emitter;
  private statsTimer: NodeJS.Timeout | null = null;

  constructor({ httpServer, store, registry, emitter }: WsServerOptions) {
    this.store = store;
    this.registry = registry;
    this.emitter = emitter;

    // Share the HTTP server rather than binding a second port, so REST and the
    // socket live behind one origin and the mobile config has one host to
    // resolve.
    this.wss = new WebSocketServer({ server: httpServer, path: "/stream" });
    this.wss.on("connection", socket => this.handleConnection(socket));
  }

  start(): void {
    this.registry.startHeartbeat();

    // Roll the rate counters and push telemetry on the same timer, so the
    // numbers the Telemetry screen renders are the ones that were just sampled
    // rather than a mixture of two sampling windows.
    this.statsTimer = setInterval(() => {
      stats.roll();
      this.registry.broadcast({
        type: "stats",
        serverTime: Date.now(),
        stats: stats.snapshot(),
      });
    }, config.statsIntervalMs);
  }

  stop(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    this.registry.stopHeartbeat();
    this.registry.closeAll();
    this.wss.close();
  }

  /** Tell every client about an upstream state change (R24). */
  broadcastUpstreamState(state: UpstreamState): void {
    this.registry.broadcast({ type: "status", upstream: state, serverTime: Date.now() });
  }

  private handleConnection(socket: WebSocket): void {
    const client = this.registry.add(socket);

    // No book on the initial snapshot: the client has not subscribed yet, and
    // the screen that needs depth asks for it on mount.
    const snapshot: ServerMessage = {
      type: "snapshot",
      serverTime: Date.now(),
      pairs: this.store.projectAll(false),
    };
    this.registry.sendTo(client, snapshot);
    this.registry.sendTo(client, {
      type: "status",
      upstream: stats.getUpstreamState(),
      serverTime: Date.now(),
    });
    this.registry.sendTo(client, {
      type: "config",
      emitIntervalMs: this.emitter.currentIntervalMs,
    });

    socket.on("message", raw => this.handleMessage(socket, client.id, decodeFrame(raw)));

    socket.on("error", error => {
      logger.warn(`[ws] client ${client.id} socket error`, { message: error.message });
    });

    socket.on("close", () => this.registry.remove(socket));
  }

  private handleMessage(socket: WebSocket, clientId: number, raw: string): void {
    const client = this.registry.get(socket);
    if (!client) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.registry.sendTo(client, { type: "error", message: "malformed JSON" });
      return;
    }

    if (!isClientMessage(parsed)) {
      this.registry.sendTo(client, { type: "error", message: "unrecognised message" });
      return;
    }

    switch (parsed.type) {
      case "subscribeDepth": {
        // Filter to configured pairs so a client cannot make the gateway hold
        // subscriptions for symbols it does not ingest.
        const valid = parsed.pairs.filter(pair => this.store.hasPair(pair));
        this.registry.setDepthSubscription(socket, valid);
        logger.debug(`[ws] client ${clientId} depth subscription: ${valid.join(",") || "none"}`);

        // Answer immediately with the current book rather than making the
        // detail screen wait for the next tick - otherwise opening a pair in a
        // quiet market shows an empty order book for a noticeable beat.
        if (valid.length > 0) {
          const pairs = valid
            .map(pair => this.store.project(pair, false, true))
            .filter((update): update is NonNullable<typeof update> => update !== null);
          this.registry.sendTo(client, {
            type: "snapshot",
            serverTime: Date.now(),
            pairs,
          });
        }
        break;
      }

      case "setEmitInterval": {
        const applied = this.emitter.setIntervalMs(parsed.ms);
        // Broadcast, not reply: the interval is global, so a second client
        // watching the Telemetry screen must see the slider move too.
        this.registry.broadcast({ type: "config", emitIntervalMs: applied });
        break;
      }
    }
  }
}
