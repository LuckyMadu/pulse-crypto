/**
 * Animation durations.
 *
 * `flashIn` / `flashOut` are the price-change highlight (R21, R22). The
 * asymmetry is deliberate: the colour snaps on fast enough to register as an
 * event and decays slowly enough to still be visible when the next tick lands
 * 100 ms later. A symmetric fade at this update rate reads as a flicker rather
 * than as a signal.
 *
 * `flashOut` is deliberately longer than the default 100 ms emit interval, so
 * consecutive ticks blend into a sustained tint during a fast move rather than
 * strobing - which is both more readable and easier on the eye.
 */

export const durations = {
  flashIn: 90,
  flashOut: 420,
  /** Order book depth bar width interpolation (R23). */
  depthBar: 180,
  /** Buy/sell pressure meter. Slower: it is a trend, not an event. */
  meter: 300,
  fade: 200,
  /** Live-dot tick pulse. Same asymmetry as the flash, for the same reason. */
  pulseIn: 90,
  pulseOut: 260,
  /**
   * Floor on how long the pull-to-refresh spinner stays up. `/pairs/meta`
   * answers from a local gateway in about a millisecond, so a spinner bound
   * straight to the request never survives a frame and the gesture reads as
   * though nothing happened. This is a loading indicator rather than a
   * feedback animation, so the 300 ms ceiling on the latter does not apply.
   */
  refreshFloor: 500,
} as const;

/**
 * Peak scale of the live-dot pulse. Large enough to catch the eye at 6pt,
 * small enough not to reflow the row it sits in.
 */
export const pulseScale = 1.8;
