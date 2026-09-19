import { StyleSheet } from "react-native";
import { colors, sizes, spacing } from "@design-system";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  content: {
    padding: spacing.md,
    paddingBottom: sizes.bottomNav,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  listItem: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  listText: {
    flex: 1,
  },
});
