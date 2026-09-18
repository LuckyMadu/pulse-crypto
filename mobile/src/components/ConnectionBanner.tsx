/**
 * The offline / degraded banner (R24, R25).
 *
 * Two distinct conditions, and keeping them distinct is the point:
 *
 *  - **Our socket is down.** Prices are frozen. The banner says so *and* says
 *    the data on screen is retained rather than live, because a frozen number
 *    with no explanation is worse than no number - the user cannot tell
 *    whether the market stopped or the app did.
 *
 *  - **The gateway is up but its upstream is reconnecting.** Our connection is
 *    fine; Binance is not reachable. Different message, because the user's
 *    remedy is different (wait, rather than check their own network).
 *
 * Renders nothing when everything is healthy. A permanent "connected" bar is
 * chrome that costs vertical space to tell the user what they can already see
 * from prices moving.
 */

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, colors, radii, spacing } from "@design-system";
import { useConnectionStatus, useUpstreamState } from "@realtime";

export const ConnectionBanner = memo(() => {
  const status = useConnectionStatus();
  const upstream = useUpstreamState();

  if (status === "offline" || status === "reconnecting") {
    return (
      <View style={[styles.banner, styles.down]}>
        <Text variant="label" tone="down">
          {status === "offline" ? "Offline" : "Reconnecting"}
        </Text>
        <Text variant="caption" tone="secondary">
          Showing last received prices
        </Text>
      </View>
    );
  }

  if (status === "live" && upstream === "reconnecting") {
    return (
      <View style={[styles.banner, styles.warning]}>
        <Text variant="label" tone="muted">
          Market feed reconnecting
        </Text>
        <Text variant="caption" tone="secondary">
          Gateway is up; upstream data is paused
        </Text>
      </View>
    );
  }

  if (status === "live" && upstream === "synthetic") {
    return (
      <View style={[styles.banner, styles.warning]}>
        <Text variant="label" tone="muted">
          Synthetic load
        </Text>
        <Text variant="caption" tone="secondary">
          Generated market data, not Binance
        </Text>
      </View>
    );
  }

  return null;
});

ConnectionBanner.displayName = "ConnectionBanner";

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
  },
  down: {
    backgroundColor: colors.down.fill,
  },
  warning: {
    backgroundColor: colors.bg.row,
  },
});
