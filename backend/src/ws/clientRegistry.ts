/**
 * Stage 3a: who is connected, what they asked for, and whether they are
 * keeping up (R6, R32).
 *
 * ## The slow-consumer policy
 *
 * A WebSocket `send()` never blocks. If the peer stops reading - a backgrounded
 * phone, a device on a train, a debugger paused on a breakpoint - the frames do
 * not vanish, they accumulate in the socket's send buffer inside the server
 * process. Keep calling `send()` at 10 Hz against a peer that is not draining
 * and that buffer is the unbounded growth the brief warns about, once per slow
 * client.
 *
 * So before every send: if `bufferedAmount` is over budget, **skip the frame**.
 *
 * ## Why skipping is safe, and why that is the elegant part
 *
 * Skipping would be lossy and unacceptable for a message stream where every
 * event matters. It is safe here *because of conflation upstream*: the next
 * tick's payload is built fresh from current state, not from a replay queue. A
 * client that misses four frames and receives the fifth is fully caught up the
 * instant it drains - it sees current prices, not a backlog to chew through.
 *
 * That is the property worth pointing at: the conflation buffer and the
 * backpressure policy are not two separate features, they are one design. The
 * buffer is what makes dropping frames a latency cost instead of a correctness
 * cost.
 *
 * A client over budget for `maxConsecutiveSkips` ticks in a row is not lagging,
 * it is gone - so it gets `terminate()`d, releasing the buffer. Separately, a
 * ping/pong heartbeat reaps half-open sockets, which `close` events never
 * report because the peer vanished without sending a FIN.
 */

import { WebSocket } from "ws";
import { config } from "../config";
import { stats } from "../stats";
import { ServerMessage } from "../types/protocol";
import { logger } from "../utils/logger";

export interface Client {
  id: number;
  socket: WebSocket;
  /** Pairs this client wants order book depth for. Empty for the watchlist. */
  depthPairs: Set<string>;
  /** Ticks in a row this client has been over its send budget. */
  consecutiveSkips: number;
  /** Cleared on pong; a client still false at the next sweep is half-open. */
  isAlive: boolean;
  connectedAt: number;
}

/**
 * A stable key for a client's depth subscription, used to group clients that
 * will receive byte-identical payloads. Sorted so `{BTC,ETH}` and `{ETH,BTC}`
 * collapse to one group.
 */
const subscriptionKey = (client: Client): string =>
  client.depthPairs.size === 0 ? "" : [...client.depthPairs].sort().join(",");

export class ClientRegistry {
  private readonly clients = new Map<WebSocket, Client>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private nextId = 1;

  constructor() {
    stats.registerProviders({ connectedClients: () => this.clients.size });
  }

  get size(): number {
    return this.clients.size;
  }

  add(socket: WebSocket): Client {
    const client: Client = {
      id: this.nextId++,
      socket,
      depthPairs: new Set(),
      consecutiveSkips: 0,
      isAlive: true,
      connectedAt: Date.now(),
    };
    this.clients.set(socket, client);

    socket.on("pong", () => {
      client.isAlive = true;
    });

    logger.info(`[ws] client ${client.id} connected (${this.clients.size} total)`);
    return client;
  }

  remove(socket: WebSocket): void {
    const client = this.clients.get(socket);
    if (!client) return;
    this.clients.delete(socket);
    logger.info(`[ws] client ${client.id} disconnected (${this.clients.size} total)`);
  }

  get(socket: WebSocket): Client | undefined {
    return this.clients.get(socket);
  }

  /**
   * Replace a client's depth subscription set.
   *
   * Replace rather than merge: navigating between detail screens should not
   * accumulate subscriptions the client no longer renders, and making the
   * client responsible for unsubscribing is a leak waiting to happen.
   */
  setDepthSubscription(socket: WebSocket, pairs: string[]): Set<string> {
    const client = this.clients.get(socket);
    if (!client) return new Set();
    client.depthPairs = new Set(pairs);
    return client.depthPairs;
  }

  /**
   * Clients grouped by identical depth subscription.
   *
   * This is what keeps serialization sub-linear in client count: the emitter
   * stringifies once per *group*, not once per client. With a watchlist and one
   * open detail screen that is two groups regardless of how many phones are
   * attached.
   */
  groupBySubscription(): Map<string, Client[]> {
    const groups = new Map<string, Client[]>();
    for (const client of this.clients.values()) {
      const key = subscriptionKey(client);
      const group = groups.get(key);
      if (group) group.push(client);
      else groups.set(key, [client]);
    }
    return groups;
  }

  /**
   * Send a pre-serialized frame, honouring the backpressure budget (R6).
   *
   * Takes a string rather than an object precisely so the caller can serialize
   * once and hand the same string to every client in the group.
   *
   * @returns whether the frame was written.
   */
  send(client: Client, serialized: string): boolean {
    if (client.socket.readyState !== WebSocket.OPEN) return false;

    if (client.socket.bufferedAmount > config.backpressure.maxBufferedBytes) {
      client.consecutiveSkips += 1;
      stats.recordDroppedFrame();

      if (client.consecutiveSkips >= config.backpressure.maxConsecutiveSkips) {
        logger.warn(
          `[ws] terminating client ${client.id}: over send budget for ` +
            `${client.consecutiveSkips} consecutive ticks ` +
            `(buffered ${client.socket.bufferedAmount}B)`,
        );
        stats.recordTerminatedClient();
        // `terminate()`, not `close()`: a closing handshake requires the peer to
        // respond, and this peer has demonstrably stopped reading.
        client.socket.terminate();
        this.clients.delete(client.socket);
      }
      return false;
    }

    // Under budget, so the client is draining - forgive its earlier skips.
    // Without this reset, a client that hiccuped 49 times over an hour would be
    // killed by an unrelated 50th, which is not the behaviour "sustained
    // backpressure" describes.
    client.consecutiveSkips = 0;
    client.socket.send(serialized);
    return true;
  }

  /** Serialize once here too - `broadcast` is used for low-rate control frames. */
  broadcast(message: ServerMessage): void {
    const serialized = JSON.stringify(message);
    for (const client of this.clients.values()) {
      this.send(client, serialized);
    }
  }

  sendTo(client: Client, message: ServerMessage): void {
    this.send(client, JSON.stringify(message));
  }

  /**
   * Ping every client; anything that did not pong since the last sweep is
   * half-open and gets dropped. Two sweeps rather than a timer per socket keeps
   * this O(1) in timers.
   */
  startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const client of [...this.clients.values()]) {
        if (!client.isAlive) {
          logger.warn(`[ws] client ${client.id} failed heartbeat, terminating`);
          client.socket.terminate();
          this.clients.delete(client.socket);
          continue;
        }
        client.isAlive = false;
        client.socket.ping();
      }
    }, config.backpressure.heartbeatIntervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  closeAll(code = 1001, reason = "server shutting down"): void {
    for (const client of this.clients.values()) {
      client.socket.close(code, reason);
    }
    this.clients.clear();
  }
}
