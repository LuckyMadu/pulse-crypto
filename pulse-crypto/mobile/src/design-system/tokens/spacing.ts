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
  /** Tab bar's own height: `bottomNav` plus its vertical padding. */
  tabBar: 80,
  /** Measured from mockup node 1:39. The depth overlay is sized against it. */
  orderBookRow: 32,
  orderBookHeader: 20,
  marketRow: 64,
  touchTarget: 44,
  liveDot: 6,
  /**
   * Bottom padding for a scrolling screen so its last row clears the tab bar.
   * A token rather than `bottomNav + spacing.lg` at the call site: the sum is
   * the thing being specified, and deriving it in three `.styles.ts` files
   * invites one of them to drift.
   */
  tabBarClearance: 88,
  /** Depth chart viewBox height. The SVG geometry is projected against it. */
  depthChart: 120,
  sliderThumb: 22,
  sliderTrack: 6,
  meterBar: 8,
  /** Star column in a market row - wide enough not to shift the price column. */
  favouriteColumn: 32,
  /**
   * Press-target padding for controls whose glyph is smaller than
   * `touchTarget`. Applied via `hitSlop`, so it grows the target without
   * changing layout.
   */
  hitSlop: 12,
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
  /**
   * Stroke for the depth chart paths. Sub-pixel because it is drawn inside a
   * 0-100 viewBox that SVG then scales up to the container width.
   */
  chartStroke: 0.4,
} as const;
