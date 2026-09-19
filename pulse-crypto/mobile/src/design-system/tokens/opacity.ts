/**
 * Interaction-state opacities.
 *
 * Three values rather than a general ramp, because these are the only states
 * the app has: a control being pressed, a control that cannot be pressed, and
 * anything else. Naming them stops `opacity: 0.6` and `opacity: 0.7` drifting
 * apart across components that are meant to feel identical.
 */

export const opacities = {
  /** Pressed feedback on a filled control. */
  pressed: 0.7,
  /** Pressed feedback on a bare control, where the glyph carries the change. */
  pressedSubtle: 0.6,
  disabled: 0.4,
} as const;
