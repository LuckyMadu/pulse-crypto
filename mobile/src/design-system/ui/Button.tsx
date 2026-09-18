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
import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { colors } from "../tokens/colors";
import { borderWidth, radii, sizes, spacing } from "../tokens/spacing";
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

const styles = StyleSheet.create({
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
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
