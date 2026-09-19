/**
 * The only module permitted to read `process.env`.
 *
 * Everything is parsed and range-checked once at import time, so a typo in
 * `EMIT_INTERVAL_MS` fails at boot with a readable message instead of turning
 * into a `NaN` that silently disables the emitter twenty minutes into a demo.
 */

class ConfigError extends Error {
  constructor(message: string) {
    super(`[config] ${message}`);
    this.name = "ConfigError";
  }
}

const readInt = (
  name: string,
  fallback: number,
  { min, max }: { min: number; max: number },
): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new ConfigError(`${name} must be an integer, received "${raw}"`);
  }
  if (parsed < min || parsed > max) {
    throw new ConfigError(`${name} must be between ${min} and ${max}, received ${parsed}`);
  }
  return parsed;
};

const readBool = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
};

const readList = (name: string, fallback: string[]): string[] => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;

  const parsed = raw
    .split(",")
    .map(entry => entry.trim().toUpperCase())
    .filter(Boolean);
  if (parsed.length === 0) {
    throw new ConfigError(`${name} was set but produced no pairs`);
  }
  return parsed;
};

/** R5: the brief's bounds for the configurable emit interval. */
export const EMIT_INTERVAL_MIN_MS = 10;
export const EMIT_INTERVAL_MAX_MS = 1000;

export const config = {
  port: readInt("PORT", 8080, { min: 1, max: 65535 }),

  /**
   * R1. The brief names these five. Order is the display order in the app.
   */
  pairs: readList("PAIRS", ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOGEUSDT", "XRPUSDT"]),

  /**
   * R5. The brief says 100 ms; the mockup's slider reads 250 ms. The brief
   * wins - see README assumptions.
   */
  emitIntervalMs: readInt("EMIT_INTERVAL_MS", 100, {
    min: EMIT_INTERVAL_MIN_MS,
    max: EMIT_INTERVAL_MAX_MS,
  }),

  upstream: {
    /**
     * `data-stream.binance.vision` is the public market-data host: no auth and
     * fewer regional restrictions than `stream.binance.com`, which matters
     * because a reviewer on a blocked network would otherwise see an app that
     * connects to the gateway but shows no prices.
     */
    host: process.env.BINANCE_WS_HOST ?? "data-stream.binance.vision",
    /** Top-N order book levels. 20 is the largest partial-depth stream. */
    depthLevels: readInt("DEPTH_LEVELS", 20, { min: 5, max: 20 }),
    reconnectBaseMs: readInt("RECONNECT_BASE_MS", 500, { min: 50, max: 10_000 }),
    reconnectMaxMs: readInt("RECONNECT_MAX_MS", 15_000, { min: 1_000, max: 120_000 }),
    /** Binance closes idle sockets; no frame for this long means reconnect. */
    stallTimeoutMs: readInt("UPSTREAM_STALL_TIMEOUT_MS", 30_000, {
      min: 5_000,
      max: 300_000,
    }),
  },

  backpressure: {
    /**
     * R6. Per-socket kernel+userland send budget. Exceeding it means the client
     * is not draining, so the next frame is skipped rather than queued.
     */
    maxBufferedBytes: readInt("MAX_BUFFERED_BYTES", 1_048_576, {
      min: 4_096,
      max: 67_108_864,
    }),
    /**
     * R6. Consecutive over-budget ticks tolerated before `terminate()`. At the
     * default 100 ms interval, 50 ticks is 5 s of a client making no progress.
     */
    maxConsecutiveSkips: readInt("MAX_CONSECUTIVE_SKIPS", 50, { min: 1, max: 10_000 }),
    /** R32. Ping period for reaping half-open sockets. */
    heartbeatIntervalMs: readInt("HEARTBEAT_INTERVAL_MS", 30_000, {
      min: 1_000,
      max: 300_000,
    }),
  },

  /** R20. Replaces the upstream with a ~2000 msg/s generator. */
  syntheticLoad: readBool("SYNTHETIC_LOAD", false),
  syntheticMsgsPerSec: readInt("SYNTHETIC_MSGS_PER_SEC", 2000, {
    min: 1,
    max: 100_000,
  }),

  /** How often the `stats` frame and the rate counters roll over. */
  statsIntervalMs: readInt("STATS_INTERVAL_MS", 1000, { min: 100, max: 60_000 }),

  logLevel: (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error",
} as const;

export type Config = typeof config;
