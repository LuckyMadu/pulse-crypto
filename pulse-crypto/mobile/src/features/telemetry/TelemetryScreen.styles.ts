import { StyleSheet } from "react-native";
import { colors, sizes, spacing } from "@design-system";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  content: {
    padding: spacing.md,
    paddingBottom: sizes.tabBarClearance,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  footer: {
    paddingTop: spacing.sm,
  },
});
