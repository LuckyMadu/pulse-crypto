/**
 * Small status pills: `LIVE`, `HEALTHY`, `+2.45%`, `SPREAD 0.01%`.
 *
 * Tinted rather than solid - a solid fill at this size competes with the
 * numbers it sits beside, which are the thing the screen is actually about.
 */

import { ReactNode, memo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../tokens/colors";
import { radii, spacing } from "../tokens/spacing";
import { Text, TextTone } from "./Text";

export type ChipTone = "up" | "down" | "neutral" | "brand" | "warning";

const TONE_STYLES: Record<ChipTone, { background: string; text: TextTone }> = {
  up: { background: colors.up.fill, text: "up" },
  down: { background: colors.down.fill, text: "down" },
  neutral: { background: colors.bg.row, text: "secondary" },
  brand: { background: colors.up.fill, text: "brand" },
  warning: { background: "rgba(245,166,35,0.12)", text: "muted" },
};

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  /** A small leading element, typically a status dot. */
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Chip = memo(({ label, tone = "neutral", leading, style }: ChipProps) => {
  const toneStyle = TONE_STYLES[tone];

  return (
    <View style={[styles.chip, { backgroundColor: toneStyle.background }, style]}>
      {leading}
      <Text variant="label" tone={toneStyle.text}>
        {label}
      </Text>
    </View>
  );
});

Chip.displayName = "Chip";

const styles = StyleSheet.create({
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
