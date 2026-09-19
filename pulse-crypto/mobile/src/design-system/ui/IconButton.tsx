/**
 * A compact pressable, used for the favourite toggle and the tab bar pills.
 *
 * The `hitSlop` is not incidental: the favourite star is 20pt of visible glyph
 * inside a 64pt list row, and without slop it is a genuinely difficult target
 * on a moving list. `sizes.touchTarget` (44) is the platform minimum.
 */

import { ReactNode, memo } from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import { sizes } from "../tokens/spacing";
import { styles } from "./IconButton.styles";

export interface IconButtonProps {
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel: string;
  accessibilityState?: { selected?: boolean; checked?: boolean };
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const IconButton = memo(
  ({
    onPress,
    children,
    accessibilityLabel,
    accessibilityState,
    active = false,
    style,
  }: IconButtonProps) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      hitSlop={sizes.hitSlop}
      style={({ pressed }) => [
        styles.button,
        active && styles.active,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  ),
);

IconButton.displayName = "IconButton";
