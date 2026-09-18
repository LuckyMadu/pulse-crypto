/**
 * The style guide's search field with a leading icon. Backs R14.
 *
 * The magnifier is drawn with two `View`s - a circle and a rotated bar -
 * rather than pulled from an icon library. One glyph does not justify a
 * dependency, and a vector icon package would need font linking on top.
 */

import { memo } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors } from "../tokens/colors";
import { radii, sizes, spacing } from "../tokens/spacing";
import { fontFamily, fontSize } from "../tokens/typography";
import { Text } from "./Text";

export interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}

const SearchIcon = () => (
  <View style={styles.icon}>
    <View style={styles.iconLens} />
    <View style={styles.iconHandle} />
  </View>
);

export const SearchField = memo(
  ({
    value,
    onChangeText,
    placeholder = "Search pairs",
    accessibilityLabel = "Search trading pairs",
  }: SearchFieldProps) => (
    <View style={styles.container}>
      <SearchIcon />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="characters"
        autoCorrect={false}
        // `search` rather than `done`: the filter is live, so the key is only
        // there to dismiss the keyboard.
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.clear}
        >
          <Text variant="label" tone="muted">
            Clear
          </Text>
        </Pressable>
      ) : null}
    </View>
  ),
);

SearchField.displayName = "SearchField";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.elevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.md,
    height: sizes.touchTarget,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    // Android's TextInput carries vertical padding that misaligns it against
    // the icon inside a fixed-height row.
    paddingVertical: 0,
  },
  icon: {
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  iconLens: {
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.text.muted,
  },
  iconHandle: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 6,
    height: 1.5,
    backgroundColor: colors.text.muted,
    transform: [{ rotate: "45deg" }],
  },
  clear: {
    paddingHorizontal: spacing.xs,
  },
});
