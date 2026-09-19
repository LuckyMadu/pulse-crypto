import { StyleSheet } from "react-native";
import { radii, sizes, spacing } from "@design-system";

export const styles = StyleSheet.create({
  row: {
    height: sizes.marketRow,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    gap: spacing.xxs,
  },
  pairLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  values: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  favourite: {
    width: sizes.favouriteColumn,
    alignItems: "flex-end",
  },
});
