import { StyleSheet } from "react-native";
import { colors } from "../tokens/colors";
import { radii } from "../tokens/spacing";

export type MeterTone = "up" | "down" | "neutral";

export const toneStyles = StyleSheet.create({
  up: { backgroundColor: colors.up.base },
  down: { backgroundColor: colors.down.base },
  neutral: { backgroundColor: colors.text.muted },
});

export const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: colors.bg.row,
    // A pill radius clamps to half the height at any height, so the track and
    // fill stay rounded without deriving a radius from the `height` prop.
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radii.pill,
  },
});
