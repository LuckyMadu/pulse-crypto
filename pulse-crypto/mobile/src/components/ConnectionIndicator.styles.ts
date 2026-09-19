import { StyleSheet } from "react-native";
import { colors, radii, sizes } from "@design-system";

export const dotStyles = StyleSheet.create({
  connecting: { backgroundColor: colors.status.warning },
  live: { backgroundColor: colors.status.live },
  reconnecting: { backgroundColor: colors.status.warning },
  offline: { backgroundColor: colors.status.offline },
});

export const styles = StyleSheet.create({
  dot: {
    width: sizes.liveDot,
    height: sizes.liveDot,
    borderRadius: radii.pill,
  },
});
