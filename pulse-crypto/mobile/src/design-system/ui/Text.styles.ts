import { StyleSheet } from "react-native";
import { colors } from "../tokens/colors";

export type TextTone =
  | "primary"
  | "secondary"
  | "muted"
  | "up"
  | "down"
  | "brand"
  | "inverted";

/**
 * Tone colours registered once rather than built per render.
 *
 * `Text` is the most-rendered component in the app - every order book row,
 * every market row, every price - and those re-render at tick rate. Returning
 * a fresh `{ color }` object on each render allocated one object per text node
 * per tick, which is measurable at 10 Hz across five pairs and twenty book
 * levels. `StyleSheet.create` builds these once at import.
 */
export const toneStyles = StyleSheet.create({
  primary: { color: colors.text.primary },
  secondary: { color: colors.text.secondary },
  muted: { color: colors.text.muted },
  up: { color: colors.up.text },
  down: { color: colors.down.text },
  brand: { color: colors.brand },
  inverted: { color: colors.text.inverted },
});
