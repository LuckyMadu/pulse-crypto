import { StyleSheet } from "react-native";
import { colors, sizes, spacing } from "@design-system";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  search: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  list: {
    paddingBottom: sizes.bottomNav,
  },
  empty: {
    padding: spacing.xl,
    alignItems: "center",
  },
});

/** `RefreshControl` takes colours as props, not styles. */
export const REFRESH_COLOURS = [colors.brand];
