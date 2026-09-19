/**
 * An 8-point spacing scale, as declared by the style guide, plus the fixed
 * dimensions measured off the mockup frames.
 *
 * The fixed heights are separate from the scale on purpose: `orderBookRow: 32`
 * is not "four spacing units", it is a measured constant that the row layout
 * and the depth-bar animation both depend on. Conflating the two invites
 * someone to "tidy" it into `spacing.xl` and silently change the row geometry.
 */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const sizes = {
  topAppBar: 56,
  bottomNav: 64,
  /** Measured from mockup node 1:39. The depth overlay is sized against it. */
  orderBookRow: 32,
  orderBookHeader: 20,
  marketRow: 64,
  touchTarget: 44,
  liveDot: 6,
} as const;

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const borderWidth = {
  hairline: 1,
  thick: 2,
} as const;
