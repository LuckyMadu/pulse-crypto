/**
 * The shared app bar from the mockup: title on the left, live connection
 * indicator on the right.
 *
 * Rendered per screen rather than by the navigator so each screen can supply
 * its own title and optional back affordance without a navigator-wide options
 * object - and so the connection indicator is a single component mounted once
 * per screen rather than a header renderer re-created on navigation.
 */

import { ReactNode, memo, useMemo } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, sizes } from "@design-system";
import { ConnectionIndicator } from "./ConnectionIndicator";
import { styles } from "./TopAppBar.styles";

export interface TopAppBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}

export const TopAppBar = memo(({ title, subtitle, onBack, trailing }: TopAppBarProps) => {
  const insets = useSafeAreaInsets();
  const insetStyle = useMemo(() => ({ paddingTop: insets.top }), [insets.top]);

  return (
    <View style={[styles.container, insetStyle]}>
      <View style={styles.bar}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={sizes.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.back}
          >
            <Text variant="title" tone="secondary">
              {"\u2039"}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.titles}>
          <Text variant="title" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="label" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {trailing ?? <ConnectionIndicator />}
      </View>
    </View>
  );
});

TopAppBar.displayName = "TopAppBar";
