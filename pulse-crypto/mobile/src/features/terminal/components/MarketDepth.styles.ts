import { StyleSheet } from "react-native";
import { sizes, spacing } from "@design-system";

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  empty: {
    height: sizes.depthChart,
    alignItems: "center",
    justifyContent: "center",
  },
});
