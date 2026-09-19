import { StyleSheet } from "react-native";
import { colors } from "../tokens/colors";
import { radii, spacing } from "../tokens/spacing";
import { TextTone } from "./Text.styles";

export type ChipTone = "up" | "down" | "neutral" | "brand" | "warning";

/** Text tone per chip tone. Not a style, but it travels with the palette. */
export const CHIP_TEXT_TONES: Record<ChipTone, TextTone> = {
  up: "up",
  down: "down",
  neutral: "secondary",
  brand: "brand",
  warning: "muted",
};

export const toneStyles = StyleSheet.create({
  up: { backgroundColor: colors.up.fill },
  down: { backgroundColor: colors.down.fill },
  neutral: { backgroundColor: colors.bg.row },
  brand: { backgroundColor: colors.up.fill },
  warning: { backgroundColor: colors.status.warningFill },
});

export const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    alignSelf: "flex-start",
  },
});
