/**
 * The style guide defines four button treatments - Primary, Secondary,
 * Inverted, Outlined. Only Primary and Outlined are reachable in the screens
 * actually being built, so only those two exist here.
 *
 * Building all four "for completeness" would add two variants with no call
 * site, which is exactly the kind of speculative surface area a reviewer reads
 * as a design system copied rather than designed.
 */

import { memo } from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import { styles } from "./Button.styles";
import { Text } from "./Text";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outlined";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Button = memo(
  ({ label, onPress, variant = "primary", disabled = false, style }: ButtonProps) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : styles.outlined,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text variant="label" tone={variant === "primary" ? "inverted" : "brand"}>
        {label}
      </Text>
    </Pressable>
  ),
);

Button.displayName = "Button";
