import { StyleSheet } from "react-native";
import { colors } from "../tokens/colors";
import { opacities } from "../tokens/opacity";
import { borderWidth, radii, sizes, spacing } from "../tokens/spacing";

export const styles = StyleSheet.create({
  base: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
  primary: {
    backgroundColor: colors.brand,
  },
  outlined: {
    borderWidth: borderWidth.hairline,
    borderColor: colors.brand,
  },
  pressed: {
    opacity: opacities.pressed,
  },
  disabled: {
    opacity: opacities.disabled,
  },
});
