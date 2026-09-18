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
} as const;
