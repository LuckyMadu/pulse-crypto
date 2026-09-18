/**
 * A `View` with the app's background levels and padding scale applied by name.
 *
 * Exists so that "a card" is one token choice rather than four style
 * properties repeated across every feature, and so the elevation vocabulary
 * (`base` / `elevated` / `row`) stays closed.
 */

import { ReactNode } from "react";
import { StyleProp, View, ViewProps, ViewStyle } from "react-native";
import { colors } from "../tokens/colors";
import { borderWidth, radii, spacing } from "../tokens/spacing";

type Level = "base" | "elevated" | "row" | "transparent";
type Padding = keyof typeof spacing;
type Radius = keyof typeof radii;

const LEVEL_COLOURS: Record<Level, string> = {
  base: colors.bg.base,
  elevated: colors.bg.elevated,
  row: colors.bg.row,
  transparent: "transparent",
};

export interface SurfaceProps extends Omit<ViewProps, "style"> {
  level?: Level;
  padding?: Padding;
  radius?: Radius;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export const Surface = ({
  level = "elevated",
  padding = "none",
  radius = "none",
  bordered = false,
  style,
  children,
  ...rest
}: SurfaceProps) => (
  <View
    style={[
      {
        backgroundColor: LEVEL_COLOURS[level],
        padding: spacing[padding],
        borderRadius: radii[radius],
      },
      bordered && {
        borderWidth: borderWidth.hairline,
        borderColor: colors.border.subtle,
      },
      style,
    ]}
    {...rest}
  >
    {children}
  </View>
);
