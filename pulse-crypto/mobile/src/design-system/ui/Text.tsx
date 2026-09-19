/**
 * The only way text reaches the screen.
 *
 * Feature code selects a named `variant` rather than a font and size, which is
 * what keeps one-off type combinations out of the codebase. `tone` does the
 * same for colour - `react-native/no-color-literals` is an ESLint error, so
 * there is no path to a hardcoded hex in a component.
 */

import { ReactNode } from "react";
import { StyleProp, Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native";
import { colors } from "../tokens/colors";
import { TextVariant, textVariants } from "../tokens/typography";

export type TextTone =
  | "primary"
  | "secondary"
  | "muted"
  | "up"
  | "down"
  | "brand"
  | "inverted";

const TONE_COLOURS: Record<TextTone, string> = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  muted: colors.text.muted,
  up: colors.up.text,
  down: colors.down.text,
  brand: colors.brand,
  inverted: colors.text.inverted,
};

export interface TextProps extends Omit<RNTextProps, "style"> {
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

export const Text = ({
  variant = "body",
  tone = "primary",
  style,
  children,
  ...rest
}: TextProps) => (
  <RNText
    // `allowFontScaling` stays on for accessibility, but numeric columns are
    // laid out with flex rather than fixed widths so a larger system font size
    // does not clip them.
    style={[textVariants[variant], { color: TONE_COLOURS[tone] }, style]}
    {...rest}
  >
    {children}
  </RNText>
);
