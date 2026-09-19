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
import { View } from "react-native";
import { Chip, ChipTone } from "@design-system";
import { ConnectionStatus, useConnectionStatus } from "@realtime";
import { dotStyles, styles } from "./ConnectionIndicator.styles";

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

const STATUS_TONES: Record<ConnectionStatus, ChipTone> = {
  connecting: "warning",
  live: "brand",
  reconnecting: "warning",
  offline: "down",
};

export const ConnectionIndicator = memo(() => {
  const status = useConnectionStatus();

  return (
    <Chip
      label={STATUS_LABELS[status]}
      tone={STATUS_TONES[status]}
      leading={<View style={[styles.dot, dotStyles[status]]} />}
    />
  );
});

ConnectionIndicator.displayName = "ConnectionIndicator";
