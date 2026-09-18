/**
 * Process entry point: wires the four stages together, binds the port, and
 * owns shutdown.
 *
 * Reading this file top to bottom is the fastest way to understand the system:
 *
 *   store  <- the conflation buffer, created first because everything needs it
 *   feed   <- Binance (or the synthetic generator) writing into the store
 *   emitter<- the timer reading the store's dirty set
 *   ws     <- the fan-out the emitter writes through
 */

import http from "node:http";
import { createApp } from "./app";
import { SyntheticFeed } from "./binance/syntheticFeed";
import { UpstreamClient } from "./binance/upstreamClient";
import { config } from "./config";
import { Emitter } from "./market/emitter";
import { getMarketStore } from "./market/marketStore";
import { logger } from "./utils/logger";
import { ClientRegistry } from "./ws/clientRegistry";
import { MarketWsServer } from "./ws/wsServer";

const store = getMarketStore(config.pairs);
const registry = new ClientRegistry();
const emitter = new Emitter({ store, registry });

const app = createApp();
const httpServer = http.createServer(app);

const wsServer = new MarketWsServer({ httpServer, store, registry, emitter });

// The synthetic feed is a full substitute rather than an overlay: running both
// would make the ingestion rate on the Telemetry screen a sum of two sources
// and the conflation ratio meaningless.
const feed = config.syntheticLoad
  ? new SyntheticFeed({ store })
  : new UpstreamClient({
      store,
      onStateChange: state => wsServer.broadcastUpstreamState(state),
    });

httpServer.listen(config.port, () => {
  logger.info(`[server] listening on http://localhost:${config.port}`);
  logger.info(`[server] websocket at ws://localhost:${config.port}/stream`);
  logger.info(`[server] pairs: ${config.pairs.join(", ")}`);
  logger.info(`[server] emit interval: ${config.emitIntervalMs}ms`);
  if (config.syntheticLoad) {
    logger.warn("[server] SYNTHETIC_LOAD=1 - serving generated data, not Binance");
  }

  feed.start();
  emitter.start();
  wsServer.start();
});

/**
 * Shut down in reverse dependency order: stop producing, stop fanning out,
 * then release the port. Without the ordered teardown, `nodemon`-style restarts
 * during development leave the old process holding 8080 and the next boot
 * fails with `EADDRINUSE`, which is a confusing five minutes to debug.
 */
let shuttingDown = false;

const shutdown = (signal: string): void => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`[server] ${signal} received, shutting down`);
  feed.stop();
  emitter.stop();
  wsServer.stop();

  httpServer.close(() => {
    logger.info("[server] closed");
    process.exit(0);
  });

  // A client mid-request can hold `close()` open indefinitely. Five seconds is
  // long enough to drain honestly and short enough not to hang a demo.
  setTimeout(() => {
    logger.warn("[server] forced exit after 5s grace period");
    process.exit(1);
  }, 5_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Last-resort guards. An uncaught throw anywhere in the pipeline should end the
// process loudly rather than leave it running in a half-initialised state that
// still answers `/health` with `healthy`.
process.on("uncaughtException", error => {
  logger.error("[server] uncaught exception", { message: error.message, stack: error.stack });
  shutdown("uncaughtException");
});

process.on("unhandledRejection", reason => {
  logger.error("[server] unhandled rejection", { reason: String(reason) });
});
