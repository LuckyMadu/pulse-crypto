/**
 * Pure scales behind the telemetry controls (R5, R20).
 *
 * Both of these were inline in their components, which made them untestable
 * without mounting a gesture handler or a chart. They are arithmetic, so they
 * belong where arithmetic can be called with a number and asserted on.
 *
 * Nothing here knows about colours or layout - `fpsHealth` returns a health
 * band and the gauge decides what that looks like.
 */

import { config } from "@config";

const { min: MIN_MS, max: MAX_MS } = config.emitIntervalRange;

/** Snap granularity, so the label does not read 237ms. */
const STEP_MS = 10;

export const INTERVAL_MIN_MS = MIN_MS;
export const INTERVAL_MAX_MS = MAX_MS;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Interval in milliseconds to a 0-1 track position.
 *
 * Clamped, because the value comes from the gateway and a figure outside the
 * configured range would otherwise drive the thumb off the end of the track.
 */
export const toRatio = (ms: number): number => {
  if (!Number.isFinite(ms)) return 0;
  return clamp01((ms - MIN_MS) / (MAX_MS - MIN_MS));
};

/** Track position back to a snapped, in-range interval. */
export const toMs = (ratio: number): number => {
  if (!Number.isFinite(ratio)) return MIN_MS;
  const raw = MIN_MS + clamp01(ratio) * (MAX_MS - MIN_MS);
  return Math.min(MAX_MS, Math.max(MIN_MS, Math.round(raw / STEP_MS) * STEP_MS));
};

export type FpsHealth = "healthy" | "fair" | "poor";

/**
 * Band a JS-thread frame rate reading.
 *
 * The healthy threshold is 55 rather than 60 deliberately: a healthy JS thread
 * sampled over a one-second window routinely reads 57-59, and treating that as
 * degraded would cry wolf on every sample.
 */
export const fpsHealth = (fps: number): FpsHealth => {
  if (!Number.isFinite(fps)) return "poor";
  if (fps >= 55) return "healthy";
  if (fps >= 40) return "fair";
  return "poor";
};
