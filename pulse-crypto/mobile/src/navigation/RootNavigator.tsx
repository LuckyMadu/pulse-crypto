/**
 * The navigation container and the app's dark theme.
 *
 * The theme override matters beyond aesthetics: React Navigation's default
 * light background flashes white between screen transitions, which on a
 * near-black trading UI is jarring enough to read as a bug.
 */

import { DarkTheme, NavigationContainer, Theme } from "@react-navigation/native";
import { colors } from "@design-system";
import { TabNavigator } from "./TabNavigator";

const theme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.brand,
    background: colors.bg.root,
    card: colors.bg.topbar,
    text: colors.text.primary,
    border: colors.border.subtle,
    notification: colors.down.base,
  },
};

export const RootNavigator = () => (
  <NavigationContainer theme={theme}>
    <TabNavigator />
  </NavigationContainer>
);
