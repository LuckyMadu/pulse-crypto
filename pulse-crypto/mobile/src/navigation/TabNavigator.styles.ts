import { StyleSheet } from "react-native";
import { borderWidth, colors, radii, sizes, spacing } from "@design-system";

/**
 * Tab glyph geometry.
 *
 * Deliberately local rather than design tokens: these are the proportions of
 * four hand-drawn 20pt glyphs and nothing else in the app can reuse
 * "candlestick bar width" or "gauge ring diameter". Promoting them to `sizes`
 * would grow the global vocabulary without giving anyone a second call site.
 */
const GLYPH = {
  pillWidth: 44,
  pillHeight: 24,
  boxWidth: 16,
  boxHeight: 14,
  barWidth: 3,
  barGap: 2,
  barShort: 8,
  barMid: 10,
  barTall: 14,
  ruleHeight: 2,
  ruleGap: 3,
  ruleRadius: 1,
  handle: 6,
  handleInset: 4,
  ring: 15,
  needleWidth: 2,
  needleHeight: 6,
  needleInset: 1,
} as const;

/** Active/inactive tint, resolved once instead of per glyph element. */
export const fillStyles = StyleSheet.create({
  active: { backgroundColor: colors.brand },
  inactive: { backgroundColor: colors.text.muted },
});

export const borderStyles = StyleSheet.create({
  active: { borderColor: colors.brand },
  inactive: { borderColor: colors.text.muted },
});

export const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg.topbar,
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: sizes.tabBar,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  iconPill: {
    width: GLYPH.pillWidth,
    height: GLYPH.pillHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  iconPillActive: {
    backgroundColor: colors.up.fill,
  },
  glyphRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: GLYPH.barGap,
    height: GLYPH.boxHeight,
  },
  glyphColumn: {
    gap: GLYPH.ruleGap,
    width: GLYPH.boxWidth,
  },
  bar: {
    width: GLYPH.barWidth,
    borderRadius: GLYPH.ruleRadius,
  },
  barShort: { height: GLYPH.barShort },
  barTall: { height: GLYPH.barTall },
  barMid: { height: GLYPH.barMid },
  rule: {
    height: GLYPH.ruleHeight,
    width: "100%",
    borderRadius: GLYPH.ruleRadius,
  },
  handle: {
    width: GLYPH.handle,
    height: GLYPH.handle,
    borderRadius: radii.pill,
    marginLeft: GLYPH.handleInset,
  },
  ring: {
    width: GLYPH.ring,
    height: GLYPH.ring,
    borderRadius: radii.pill,
    borderWidth: borderWidth.thick,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  needle: {
    width: GLYPH.needleWidth,
    height: GLYPH.needleHeight,
    marginTop: GLYPH.needleInset,
  },
});
