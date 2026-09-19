/**
 * The JS-thread frame rate gauge (R20).
 *
 * ## Why the JS thread specifically
 *
 * This is the honest metric for this architecture, and choosing it is the
 * point. Every animation in the app - price flashes, depth bars, pressure
 * meters - runs on the **UI thread** through Reanimated, so a UI-thread FPS
 * reading would stay at 60 even if JavaScript were completely saturated. It
 * would flatter the design rather than test it.
 *
 * The JS thread is where the WebSocket messages are parsed, where the store
 * notifies listeners, and where React reconciles. If tick data went through
 * Redux instead of the keyed external store, *this* is the number that would
 * visibly collapse. Holding 60 here while the gateway ingests 2000 msg/s is
 * the architecture being measured rather than asserted.
 */

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { MeterBar, Surface, Text, spacing } from "@design-system";

export interface FpsGaugeProps {
  fps: number;
}

export const FpsGauge = memo(({ fps }: FpsGaugeProps) => {
  // 55 rather than 60: a healthy JS thread sampled over a one-second window
  // routinely reads 57-59, and colouring that amber would cry wolf.
  const tone = fps >= 55 ? "up" : fps >= 40 ? "neutral" : "down";
  const textTone = fps >= 55 ? "up" : fps >= 40 ? "secondary" : "down";

  return (
    <Surface level="elevated" padding="md" radius="md" style={styles.card}>
      <View style={styles.header}>
        <Text variant="label" tone="muted">
          JS Thread Frame Rate
        </Text>
        <Text variant="numericLarge" tone={textTone}>
          {fps} FPS
        </Text>
      </View>

      <MeterBar
        value={(Math.min(fps, 60) / 60) * 100}
        tone={tone}
        height={8}
        accessibilityLabel={`JavaScript thread frame rate ${fps} frames per second`}
      />

      <Text variant="caption" tone="muted">
        Measured on the JS thread, not the UI thread - animations run on the UI
        thread and would stay smooth regardless.
      </Text>
    </Surface>
  );
});

FpsGauge.displayName = "FpsGauge";

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
