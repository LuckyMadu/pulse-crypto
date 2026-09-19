/**
 * The per-row live connection indicator (R13).
 *
 * The brief lists the watchlist row contents as "Trading Pair, Current Price,
 * 24 Hour Change, **Live Connection Indicator**, Favourite Toggle" - so the
 * indicator is a row-level element, not only the status in the app bar. That
 * is easy to misread as redundant, and it is not: a per-row dot distinguishes
 * "the connection died" from "DOGE just is not trading right now", which a
 * single global indicator cannot express and which a trader genuinely cares
 * about.
 *
 * Three states:
 *   live    - this pair ticked within the staleness window
 *   stale   - socket healthy, but this pair has gone quiet
 *   offline - socket down, so every dot goes red at once
 *
 * The pulse runs on the UI thread and is keyed on the pair's revision counter
 * rather than its price, so a tick that leaves the price unchanged still
 * registers as activity.
 */

import { memo, useEffect, useMemo } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { durations, pulseScale, sizes } from "@design-system";
import { useConnectionStatus, useIsPairLive } from "@realtime";
import { stateStyles, styles } from "./LiveDot.styles";

export interface LiveDotProps {
  timestamp: number;
  /** Monotonic tick counter for this pair; drives the pulse. */
  revision: number;
  size?: number;
}

export const LiveDot = memo(({ timestamp, revision, size = sizes.liveDot }: LiveDotProps) => {
  const status = useConnectionStatus();
  const isLive = useIsPairLive(timestamp);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (revision === 0) return;
    pulse.value = withSequence(
      withTiming(pulseScale, { duration: durations.pulseIn }),
      withTiming(1, { duration: durations.pulseOut }),
    );
  }, [pulse, revision]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const sizeStyle = useMemo(() => ({ width: size, height: size }), [size]);

  const state =
    status === "offline" || status === "reconnecting"
      ? "offline"
      : isLive
        ? "live"
        : "stale";

  return (
    <Animated.View
      accessibilityLabel={
        status === "live" ? (isLive ? "Receiving live updates" : "No recent updates") : "Disconnected"
      }
      style={[styles.dot, sizeStyle, stateStyles[state], animatedStyle]}
    />
  );
});

LiveDot.displayName = "LiveDot";
