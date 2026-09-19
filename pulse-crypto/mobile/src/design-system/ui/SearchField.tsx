/**
 * The style guide's search field with a leading icon. Backs R14.
 *
 * The magnifier is drawn with two `View`s - a circle and a rotated bar -
 * rather than pulled from an icon library. One glyph does not justify a
 * dependency, and a vector icon package would need font linking on top.
 */

import { memo } from "react";
import { Pressable, TextInput, View } from "react-native";
import { colors } from "../tokens/colors";
import { spacing } from "../tokens/spacing";
import { styles } from "./SearchField.styles";
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
