import { StyleSheet } from "react-native";
import { colors, radii } from "@design-system";

/**
 * One entry per connection state rather than a computed `backgroundColor`.
 *
 * A dot renders in every market row and re-styles on every tick, so the
 * colour lookup is worth resolving at import rather than per render.
 */
export const stateStyles = StyleSheet.create({
  offline: { backgroundColor: colors.status.offline },
  live: { backgroundColor: colors.status.live },
  stale: { backgroundColor: colors.status.stale },
});

export const styles = StyleSheet.create({
  dot: {
    borderRadius: radii.pill,
  },
});
