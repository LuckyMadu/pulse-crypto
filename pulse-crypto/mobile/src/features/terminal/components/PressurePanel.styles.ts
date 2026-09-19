import { StyleSheet } from "react-native";
import { spacing } from "@design-system";

export const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    gap: spacing.md,
  },
  meters: {
    gap: spacing.md,
  },
  meter: {
    gap: spacing.sm,
  },
  meterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spreadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
