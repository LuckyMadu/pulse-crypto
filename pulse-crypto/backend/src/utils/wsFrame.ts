/**
 * Decoding `ws` message payloads.
 *
 * `RawData` is `Buffer | ArrayBuffer | Buffer[]`, and the array case is the
 * trap: it is what arrives when a message spans multiple WebSocket frames,
 * which happens for larger payloads under fragmentation. Calling `.toString()`
 * on it invokes `Array.prototype.toString`, which comma-joins the chunks - so
 * the JSON is silently corrupted, only for big messages, only sometimes.
 */

import type { RawData } from "ws";

export const decodeFrame = (data: RawData): string => {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return Buffer.from(data).toString("utf8");
};
