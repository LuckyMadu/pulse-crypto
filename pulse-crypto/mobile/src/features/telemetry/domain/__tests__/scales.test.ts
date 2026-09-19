/**
 * The telemetry control scales (R5, R20).
 *
 * The interval scale is worth pinning down because it is the one place a user
 * gesture turns into a value the gateway acts on: a ratio that escapes 0-1, or
 * an interval that escapes the configured range, would either break the thumb
 * or be silently clamped by the server with the UI left showing a lie.
 */

import {
  INTERVAL_MAX_MS,
  INTERVAL_MIN_MS,
  fpsHealth,
  toMs,
  toRatio,
} from "../scales";

describe("R5 interval scale", () => {
  it("R5 maps the range ends to the track ends", () => {
    expect(toRatio(INTERVAL_MIN_MS)).toBe(0);
    expect(toRatio(INTERVAL_MAX_MS)).toBe(1);
    expect(toMs(0)).toBe(INTERVAL_MIN_MS);
    expect(toMs(1)).toBe(INTERVAL_MAX_MS);
  });

  it("R5 snaps to the step so the label never reads an odd figure", () => {
    const ms = toMs(0.237);

    expect(ms % 10).toBe(0);
  });

  it("R5 clamps an out-of-range server value rather than driving the thumb off the track", () => {
    expect(toRatio(INTERVAL_MAX_MS * 10)).toBe(1);
    expect(toRatio(-500)).toBe(0);
  });

  it("R5 keeps a committed interval inside the range the server will accept", () => {
    expect(toMs(5)).toBe(INTERVAL_MAX_MS);
    expect(toMs(-5)).toBe(INTERVAL_MIN_MS);
  });

  it("R5 falls back rather than propagating a non-finite value", () => {
    expect(toRatio(Number.NaN)).toBe(0);
    expect(toMs(Number.NaN)).toBe(INTERVAL_MIN_MS);
  });

  it("R5 round-trips a snapped interval unchanged", () => {
    expect(toMs(toRatio(250))).toBe(250);
    expect(toMs(toRatio(100))).toBe(100);
  });
});

describe("R20 fpsHealth", () => {
  /**
   * 55 rather than 60: a healthy JS thread sampled over a one-second window
   * routinely reads 57-59, and treating that as degraded would cry wolf on
   * every sample.
   */
  it("R20 reads a healthy thread at 57 fps rather than crying wolf", () => {
    expect(fpsHealth(57)).toBe("healthy");
    expect(fpsHealth(60)).toBe("healthy");
    expect(fpsHealth(55)).toBe("healthy");
  });

  it("R20 bands a struggling thread as fair before calling it poor", () => {
    expect(fpsHealth(54)).toBe("fair");
    expect(fpsHealth(40)).toBe("fair");
  });

  it("R20 calls a collapsed thread poor", () => {
    expect(fpsHealth(39)).toBe("poor");
    expect(fpsHealth(0)).toBe("poor");
  });

  it("R20 treats an unmeasurable reading as poor rather than healthy", () => {
    expect(fpsHealth(Number.NaN)).toBe("poor");
  });
});
