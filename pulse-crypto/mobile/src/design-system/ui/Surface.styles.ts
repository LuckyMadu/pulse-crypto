import { StyleSheet } from "react-native";
import { colors } from "../tokens/colors";
import { borderWidth, radii, spacing } from "../tokens/spacing";

export type SurfaceLevel = "base" | "elevated" | "row" | "transparent";
export type SurfacePadding = keyof typeof spacing;
export type SurfaceRadius = keyof typeof radii;

/**
 * Every level/padding/radius combination registered up front.
 *
 * `Surface` wraps most cards on the Telemetry and Terminal screens, so it
 * re-renders whenever its contents tick. Composing `{ backgroundColor,
 * padding, borderRadius }` in the render body allocated a fresh object each
 * time and defeated the style-diffing React Native does across the bridge.
 * Spelled out rather than generated so the types stay exact without a cast.
 */
export const levelStyles = StyleSheet.create({
  base: { backgroundColor: colors.bg.base },
  elevated: { backgroundColor: colors.bg.elevated },
  row: { backgroundColor: colors.bg.row },
  transparent: { backgroundColor: colors.bg.transparent },
});

export const paddingStyles = StyleSheet.create({
  none: { padding: spacing.none },
  xxs: { padding: spacing.xxs },
  xs: { padding: spacing.xs },
  sm: { padding: spacing.sm },
  md: { padding: spacing.md },
  lg: { padding: spacing.lg },
  xl: { padding: spacing.xl },
  xxl: { padding: spacing.xxl },
});

export const radiusStyles = StyleSheet.create({
  none: { borderRadius: radii.none },
  sm: { borderRadius: radii.sm },
  md: { borderRadius: radii.md },
  lg: { borderRadius: radii.lg },
  xl: { borderRadius: radii.xl },
  pill: { borderRadius: radii.pill },
});

export const styles = StyleSheet.create({
  bordered: {
    borderWidth: borderWidth.hairline,
    borderColor: colors.border.subtle,
  },
});
