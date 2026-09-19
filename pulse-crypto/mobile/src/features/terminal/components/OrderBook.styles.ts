import { StyleSheet } from "react-native";
import { colors, sizes, spacing } from "@design-system";

export const styles = StyleSheet.create({
  header: {
    height: sizes.orderBookHeader,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerPrice: { flex: 1, textAlign: "left" },
  headerAmount: { flex: 1, textAlign: "center" },
  headerTotal: { flex: 1, textAlign: "right" },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    marginVertical: spacing.xs,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
});
