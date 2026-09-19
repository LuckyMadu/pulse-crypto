/**
 * The only module allowed to call `console`. `no-console` is an ESLint error
 * everywhere else, which keeps stray debugging statements out of the codebase
 * and makes the log format changeable in one place.
 *
 * Debug output is gated on `__DEV__` so it costs nothing in a release bundle -
 * which matters more than usual here, because the streaming layer would
 * otherwise log at 10 Hz.
 */

 

export const logger = {
  debug: (message: string, meta?: unknown): void => {
    if (!__DEV__) return;
    if (meta === undefined) console.log(message);
    else console.log(message, meta);
  },
  info: (message: string, meta?: unknown): void => {
    if (!__DEV__) return;
    if (meta === undefined) console.log(message);
    else console.log(message, meta);
  },
  warn: (message: string, meta?: unknown): void => {
    if (meta === undefined) console.warn(message);
    else console.warn(message, meta);
  },
  error: (message: string, meta?: unknown): void => {
    if (meta === undefined) console.error(message);
    else console.error(message, meta);
  },
};
