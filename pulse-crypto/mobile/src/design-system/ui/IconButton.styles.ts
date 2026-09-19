import { StyleSheet } from "react-native";
import { colors } from "../tokens/colors";
import { opacities } from "../tokens/opacity";
import { radii, sizes } from "../tokens/spacing";

export const styles = StyleSheet.create({
  button: {
    minWidth: sizes.touchTarget,
    minHeight: sizes.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  active: {
    backgroundColor: colors.up.fill,
  },
  pressed: {
    opacity: opacities.pressedSubtle,
  },
});
