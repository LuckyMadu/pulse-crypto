/**
 * A level-filtered console wrapper. The house rule is that `console` appears in
 * exactly one file, which is this one - everywhere else calls `logger`, so the
 * output format and the level gate are changeable in one place.
 *
 * Deliberately not pino/winston: a single-process demo gateway does not need
 * transports or serializers, and the dependency would be the largest thing in
 * `package.json` for no behaviour a reviewer can see.
 */

import { config } from "../config";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

type Level = keyof typeof LEVELS;

const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

const emit = (level: Level, message: string, meta?: unknown): void => {
  if (LEVELS[level] < threshold) return;

  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (meta === undefined) sink(line);
  else sink(line, meta);
};

export const logger = {
  debug: (message: string, meta?: unknown) => emit("debug", message, meta),
  info: (message: string, meta?: unknown) => emit("info", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  error: (message: string, meta?: unknown) => emit("error", message, meta),
};
