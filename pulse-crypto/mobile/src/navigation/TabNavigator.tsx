/**
 * The four-tab bottom bar from the mockup: Terminal, Markets, Telemetry,
 * Settings.
 *
 * Tabs rather than a stack is what the mockup specifies, and it happens to be
 * the right call for a streaming app anyway: `@react-navigation/bottom-tabs`
 * keeps mounted screens alive when you switch away, so moving between the
 * watchlist and the terminal does not tear down and re-establish a depth
 * subscription. With a stack, every back-navigation would drop the
 * subscription and the gateway would see subscription churn on every tap.
 *
 * `Terminal` is the initial route because the mockup treats it as the primary
 * screen, and it is where the live order book lives.
 *
 * Icons are drawn as small `View` compositions rather than pulled from an icon
 * font. Four glyphs at 20pt do not justify a dependency plus asset linking,
 * and the tab bar's active treatment - the style guide's icon pill - is the
 * part that actually carries the design.
 */

import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, colors } from "@design-system";
import { MarketsScreen } from "@features/markets/MarketsScreen";
import { SettingsScreen } from "@features/settings/SettingsScreen";
import { TelemetryScreen } from "@features/telemetry/TelemetryScreen";
import { TerminalScreen } from "@features/terminal/TerminalScreen";
import { borderStyles, fillStyles, styles } from "./TabNavigator.styles";
import { TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

/** A 20pt glyph built from bars, one shape per tab. */
const TabGlyph = ({ name, active }: { name: keyof TabParamList; active: boolean }) => {
  const fill = active ? fillStyles.active : fillStyles.inactive;

  if (name === "Terminal") {
    // A candlestick: three bars of differing heights.
    return (
      <View style={styles.glyphRow}>
        <View style={[styles.bar, styles.barShort, fill]} />
        <View style={[styles.bar, styles.barTall, fill]} />
        <View style={[styles.bar, styles.barMid, fill]} />
      </View>
    );
  }

  if (name === "Markets") {
    // A list: three stacked rules.
    return (
      <View style={styles.glyphColumn}>
        <View style={[styles.rule, fill]} />
        <View style={[styles.rule, fill]} />
        <View style={[styles.rule, fill]} />
      </View>
    );
  }

  if (name === "Telemetry") {
    // A gauge: a ring with a notch.
    return (
      <View style={[styles.ring, active ? borderStyles.active : borderStyles.inactive]}>
        <View style={[styles.needle, fill]} />
      </View>
    );
  }

  // Settings: a slider track with a handle.
  return (
    <View style={styles.glyphColumn}>
      <View style={[styles.rule, fill]} />
      <View style={[styles.handle, fill]} />
    </View>
  );
};

export const TabNavigator = () => (
  <Tab.Navigator
    initialRouteName="Terminal"
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarActiveTintColor: colors.brand,
      tabBarInactiveTintColor: colors.text.muted,
      tabBarIcon: ({ focused }) => (
        <View style={[styles.iconPill, focused && styles.iconPillActive]}>
          <TabGlyph name={route.name} active={focused} />
        </View>
      ),
      tabBarLabel: ({ focused }) => (
        <Text variant="label" tone={focused ? "brand" : "muted"}>
          {route.name}
        </Text>
      ),
    })}
  >
    <Tab.Screen name="Terminal" component={TerminalScreen} />
    <Tab.Screen name="Markets" component={MarketsScreen} />
    <Tab.Screen name="Telemetry" component={TelemetryScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);
