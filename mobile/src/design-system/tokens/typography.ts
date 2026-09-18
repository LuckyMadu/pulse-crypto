/**
 * Type tokens.
 *
 * The style guide names three roles - Headline = Hanken Grotesk, Body = Inter,
 * Label = JetBrains Mono - but the implemented screens deviate: uppercase
 * labels are Inter Bold 11, and JetBrains Mono is used for every *numeric*
 * value rather than for labels. The implemented screens are the actual target,
 * so the roles below follow them while keeping the guide's three families.
 *
 * ## Why every number is monospaced
 *
 * This is the detail that makes the app read as a trading terminal, and it has
 * a functional payoff rather than only an aesthetic one: monospaced digits are
 * **tabular**, so each glyph occupies the same advance width. A price ticking
 * from `64,239.50` to `64,240.00` therefore causes no reflow. In a proportional
 * face the `1` is narrower than the `0`, so at 10 Hz every column in the order
 * book would shimmer as digits changed - which reads as jank even though no
 * frame was dropped.
 */

import { TextStyle } from "react-native";

export const fontFamily = {
  /** Headlines and the large price. */
  display: "HankenGrotesk-Bold",
  body: "Inter-Regular",
  bodyMedium: "Inter-Medium",
  bodyBold: "Inter-Bold",
  /** Every number on screen. */
  numeric: "JetBrainsMono-Medium",
  numericBold: "JetBrainsMono-Bold",
} as const;

export const fontSize = {
  xs: 10,
  sm: 11,
  md: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  display: 32,
} as const;

/**
 * Named text roles. `variant` on the `Text` primitive selects one of these,
 * which is what keeps ad hoc font/size combinations out of feature code.
 */
export const textVariants = {
  /** The big price on the Terminal screen. */
  display: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.display,
    lineHeight: 38.4,
    letterSpacing: -0.64,
  },
  heading: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  title: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.lg,
    lineHeight: 22,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: 20,
  },
  bodyMedium: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    lineHeight: 20,
  },
  /** Uppercase micro-label: "24H HIGH", "BUY PRESSURE". */
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    lineHeight: 11,
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  /** Every number: prices, quantities, percentages, metrics. */
  numeric: {
    fontFamily: fontFamily.numeric,
    fontSize: fontSize.base,
    lineHeight: 14,
  },
  numericSmall: {
    fontFamily: fontFamily.numeric,
    fontSize: fontSize.md,
    lineHeight: 14,
  },
  numericLarge: {
    fontFamily: fontFamily.numericBold,
    fontSize: fontSize.xl,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    lineHeight: 16,
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
