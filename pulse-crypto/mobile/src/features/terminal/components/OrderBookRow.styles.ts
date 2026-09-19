import { StyleSheet } from "react-native";
import { colors, sizes, spacing } from "@design-system";

/**
 * Depth bar tint per side, registered once.
 *
 * Twenty of these rows re-render on every book frame, so composing
 * `{ backgroundColor }` in the render body allocated twenty objects per tick
 * for a value that only ever takes two forms.
 */
export const sideStyles = StyleSheet.create({
  bid: { backgroundColor: colors.up.fill },
  ask: { backgroundColor: colors.down.fill },
});

export const styles = StyleSheet.create({
  row: {
    height: sizes.orderBookRow,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  depthBar: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
  },
  price: {
    flex: 1,
    textAlign: "left",
  },
  amount: {
    flex: 1,
    textAlign: "center",
  },
  total: {
    flex: 1,
    textAlign: "right",
  },
});
