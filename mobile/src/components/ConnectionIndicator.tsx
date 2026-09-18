/**
 * The global connection pill in the app bar (R24).
 *
 * This reports **our socket to the gateway**. It is not the same thing as the
 * gateway's own link to Binance, which `UpstreamNotice` covers - if the gateway
 * is up but Binance is unreachable, the honest report is "connected, but prices
 * are not moving", and collapsing those two states into one indicator would
 * make that situation unreadable.
 */

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, colors, radii, sizes } from "@design-system";
import { ConnectionStatus, useConnectionStatus } from "@realtime";

const STATUS_PRESENTATION: Record<
  ConnectionStatus,
  { label: string; tone: "brand" | "warning" | "down"; dot: string }
> = {
  connecting: { label: "Connecting", tone: "warning", dot: colors.status.warning },
  live: { label: "Live", tone: "brand", dot: colors.status.live },
  reconnecting: { label: "Reconnecting", tone: "warning", dot: colors.status.warning },
  offline: { label: "Offline", tone: "down", dot: colors.status.offline },
};

export const ConnectionIndicator = memo(() => {
  const status = useConnectionStatus();
  const presentation = STATUS_PRESENTATION[status];

  return (
    <Chip
      label={presentation.label}
      tone={presentation.tone}
      leading={<View style={[styles.dot, { backgroundColor: presentation.dot }]} />}
    />
  );
});

ConnectionIndicator.displayName = "ConnectionIndicator";

const styles = StyleSheet.create({
  dot: {
    width: sizes.liveDot,
    height: sizes.liveDot,
    borderRadius: radii.pill,
  },
});
