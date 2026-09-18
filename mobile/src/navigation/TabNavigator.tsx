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

import { StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, colors, radii, sizes, spacing } from "@design-system";
import { MarketsScreen } from "@features/markets/MarketsScreen";
import { SettingsScreen } from "@features/settings/SettingsScreen";
import { TelemetryScreen } from "@features/telemetry/TelemetryScreen";
import { TerminalScreen } from "@features/terminal/TerminalScreen";
import { TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

/** A 20pt glyph built from bars, one shape per tab. */
const TabGlyph = ({ name, active }: { name: keyof TabParamList; active: boolean }) => {
  const tint = active ? colors.brand : colors.text.muted;

  if (name === "Terminal") {
    // A candlestick: three bars of differing heights.
    return (
      <View style={styles.glyphRow}>
        <View style={[styles.bar, styles.barShort, { backgroundColor: tint }]} />
        <View style={[styles.bar, styles.barTall, { backgroundColor: tint }]} />
        <View style={[styles.bar, styles.barMid, { backgroundColor: tint }]} />
      </View>
    );
  }

  if (name === "Markets") {
    // A list: three stacked rules.
    return (
      <View style={styles.glyphColumn}>
        <View style={[styles.rule, { backgroundColor: tint }]} />
        <View style={[styles.rule, { backgroundColor: tint }]} />
        <View style={[styles.rule, { backgroundColor: tint }]} />
      </View>
    );
  }

  if (name === "Telemetry") {
    // A gauge: a ring with a notch.
    return (
      <View style={[styles.ring, { borderColor: tint }]}>
        <View style={[styles.needle, { backgroundColor: tint }]} />
      </View>
    );
  }

  // Settings: a slider track with a handle.
  return (
    <View style={styles.glyphColumn}>
      <View style={[styles.rule, { backgroundColor: tint }]} />
      <View style={[styles.handle, { backgroundColor: tint }]} />
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

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg.topbar,
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: sizes.bottomNav + spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  iconPill: {
    width: 44,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  iconPillActive: {
    backgroundColor: colors.up.fill,
  },
  glyphRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 14,
  },
  glyphColumn: {
    gap: 3,
    width: 16,
  },
  bar: {
    width: 3,
    borderRadius: 1,
  },
  barShort: { height: 8 },
  barTall: { height: 14 },
  barMid: { height: 10 },
  rule: {
    height: 2,
    width: "100%",
    borderRadius: 1,
  },
  handle: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    marginLeft: 4,
  },
  ring: {
    width: 15,
    height: 15,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  needle: {
    width: 2,
    height: 6,
    marginTop: 1,
  },
});
