import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "@design-system";

export const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
  },
  down: {
    backgroundColor: colors.down.fill,
  },
  warning: {
    backgroundColor: colors.bg.row,
  },
});
