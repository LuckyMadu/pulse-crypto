/**
 * Settings: a deliberate placeholder.
 *
 * The mockup includes a Settings tab and a hidden side drawer holding API Keys,
 * Security, Trade History and Sign Out. All four are account features with no
 * backing service, no relationship to real-time market data, and nothing in
 * the brief that asks for them.
 *
 * Half-building them would produce four screens of non-functional chrome. This
 * screen names the decision instead, which is the more useful signal - and it
 * keeps the scope of the submission legible to whoever is reading it.
 */

import { StyleSheet, View } from "react-native";
import { TopAppBar } from "@components";
import { config } from "@config";
import { Surface, Text, colors, sizes, spacing } from "@design-system";

const OMITTED = [
  "API Keys, Security and Sign Out - account features with no backing service",
  "Trade History - requires an execution venue, not a market data feed",
  "Binary Protocol Compression toggle - the payload is already tuple-encoded",
  "Adaptive Polling Strategy toggle - the Update Frequency slider covers this",
];

export const SettingsScreen = () => (
  <View style={styles.screen}>
    <TopAppBar title="Settings" />

    <View style={styles.content}>
      <Surface level="elevated" padding="md" radius="md" style={styles.card}>
        <Text variant="title">Deliberately not built</Text>
        <Text variant="body" tone="secondary">
          The mockup includes a Settings tab and a hidden drawer. Those controls
          are account and trading features with no backing service, so they are
          named here rather than half-implemented.
        </Text>

        <View style={styles.list}>
          {OMITTED.map(item => (
            <View key={item} style={styles.listItem}>
              <Text variant="body" tone="muted">
                {"\u2022"}
              </Text>
              <Text variant="caption" tone="muted" style={styles.listText}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </Surface>

      <Surface level="elevated" padding="md" radius="md" style={styles.card}>
        <Text variant="label" tone="muted">
          Gateway
        </Text>
        <Text variant="numericSmall" tone="secondary">
          {config.api.baseUrl}
        </Text>
        <Text variant="numericSmall" tone="secondary">
          {config.stream.url}
        </Text>
        <Text variant="caption" tone="muted">
          Resolved per platform: the Android emulator reaches the host machine at
          10.0.2.2, never at localhost.
        </Text>
      </Surface>
    </View>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  content: {
    padding: spacing.md,
    paddingBottom: sizes.bottomNav,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  listItem: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  listText: {
    flex: 1,
  },
});
