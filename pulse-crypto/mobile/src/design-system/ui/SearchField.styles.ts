import { StyleSheet } from "react-native";
import { colors } from "../tokens/colors";
import { borderWidth, radii, sizes, spacing } from "../tokens/spacing";
import { fontFamily, fontSize } from "../tokens/typography";

/**
 * Magnifier geometry.
 *
 * Deliberately local rather than a design token: these are the proportions of
 * one hand-drawn glyph, and nothing else in the app can reuse
 * "lens diameter" or "handle length". Promoting them to `sizes` would grow the
 * global vocabulary without giving anyone a second call site.
 */
const ICON = {
  box: 16,
  lens: 11,
  stroke: 1.5,
  handleLength: 6,
  handleOffset: 1,
} as const;

export const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.elevated,
    borderRadius: radii.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.md,
    height: sizes.touchTarget,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    // Android's TextInput carries vertical padding that misaligns it against
    // the icon inside a fixed-height row.
    paddingVertical: spacing.none,
  },
  icon: {
    width: ICON.box,
    height: ICON.box,
    justifyContent: "center",
    alignItems: "center",
  },
  iconLens: {
    width: ICON.lens,
    height: ICON.lens,
    borderRadius: radii.pill,
    borderWidth: ICON.stroke,
    borderColor: colors.text.muted,
  },
  iconHandle: {
    position: "absolute",
    right: 0,
    bottom: ICON.handleOffset,
    width: ICON.handleLength,
    height: ICON.stroke,
    backgroundColor: colors.text.muted,
    transform: [{ rotate: "45deg" }],
  },
  clear: {
    paddingHorizontal: spacing.xs,
  },
});
