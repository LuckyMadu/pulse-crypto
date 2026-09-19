import { StyleSheet } from "react-native";
import { spacing } from "@design-system";

/**
 * Narrowest a tile may get before its label wraps. Local rather than a token:
 * it is a property of this tile's content, not of the layout scale.
 */
const MIN_TILE_WIDTH = 140;

export const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing.sm,
    minWidth: MIN_TILE_WIDTH,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
});
