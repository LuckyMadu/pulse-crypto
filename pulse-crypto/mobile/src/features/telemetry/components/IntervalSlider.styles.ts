import { StyleSheet } from "react-native";
import { borderWidth, colors, radii, sizes, spacing } from "@design-system";

export const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  touchArea: {
    // The visible track is 6pt tall; the gesture target must not be.
    paddingVertical: spacing.md,
    justifyContent: "center",
  },
  track: {
    height: sizes.sliderTrack,
    backgroundColor: colors.bg.row,
    borderRadius: radii.pill,
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    height: sizes.sliderTrack,
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: sizes.sliderThumb,
    height: sizes.sliderThumb,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    borderWidth: borderWidth.thick,
    borderColor: colors.bg.elevated,
  },
  bounds: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
