import { StyleSheet } from "react-native";
import { spacing, textVariants } from "@design-system";

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  price: {
    ...textVariants.display,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    gap: spacing.xs,
  },
});
