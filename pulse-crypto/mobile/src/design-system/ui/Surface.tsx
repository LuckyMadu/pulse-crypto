/**
 * A `View` with the app's background levels and padding scale applied by name.
 *
 * Exists so that "a card" is one token choice rather than four style
 * properties repeated across every feature, and so the elevation vocabulary
 * (`base` / `elevated` / `row`) stays closed.
 */

import { ReactNode } from "react";
import { StyleProp, View, ViewProps, ViewStyle } from "react-native";
import {
  SurfaceLevel,
  SurfacePadding,
  SurfaceRadius,
  levelStyles,
  paddingStyles,
  radiusStyles,
  styles,
} from "./Surface.styles";

export type { SurfaceLevel, SurfacePadding, SurfaceRadius };

export interface SurfaceProps extends Omit<ViewProps, "style"> {
  level?: SurfaceLevel;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
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
      levelStyles[level],
      paddingStyles[padding],
      radiusStyles[radius],
      bordered && styles.bordered,
      style,
    ]}
    {...rest}
  >
    {children}
  </View>
);
