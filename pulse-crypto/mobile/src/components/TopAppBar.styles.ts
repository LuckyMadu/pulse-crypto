import { StyleSheet } from "react-native";
import { colors, sizes, spacing } from "@design-system";

/** Width of the back chevron column. Sized to the glyph, not to a scale step. */
const BACK_COLUMN = 28;

export const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.topbar,
  },
  bar: {
    height: sizes.topAppBar,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  back: {
    width: BACK_COLUMN,
    justifyContent: "center",
  },
  titles: {
    flex: 1,
    gap: spacing.xxs,
  },
});
