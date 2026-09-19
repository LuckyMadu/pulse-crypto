/**
 * Small status pills: `LIVE`, `HEALTHY`, `+2.45%`, `SPREAD 0.01%`.
 *
 * Tinted rather than solid - a solid fill at this size competes with the
 * numbers it sits beside, which are the thing the screen is actually about.
 */

import { ReactNode, memo } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { CHIP_TEXT_TONES, ChipTone, styles, toneStyles } from "./Chip.styles";
import { Text } from "./Text";

export type { ChipTone };

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  /** A small leading element, typically a status dot. */
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Chip = memo(({ label, tone = "neutral", leading, style }: ChipProps) => (
  <View style={[styles.chip, toneStyles[tone], style]}>
    {leading}
    <Text variant="label" tone={CHIP_TEXT_TONES[tone]}>
      {label}
    </Text>
  </View>
));

Chip.displayName = "Chip";
