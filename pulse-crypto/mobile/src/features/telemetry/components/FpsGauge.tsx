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
 *
 * The banding lives in `../domain/scales`; this file only decides what each
 * band looks like.
 */

import { memo } from "react";
import { View } from "react-native";
import { MeterBar, MeterTone, Surface, Text, TextTone, sizes } from "@design-system";
import { FpsHealth, fpsHealth } from "../domain/scales";
import { styles } from "./FpsGauge.styles";

/** The scale the meter is drawn against, not a health threshold. */
const FPS_CEILING = 60;

const METER_TONES: Record<FpsHealth, MeterTone> = {
  healthy: "up",
  fair: "neutral",
  poor: "down",
};

const TEXT_TONES: Record<FpsHealth, TextTone> = {
  healthy: "up",
  fair: "secondary",
  poor: "down",
};

export interface FpsGaugeProps {
  fps: number;
}

export const FpsGauge = memo(({ fps }: FpsGaugeProps) => {
  const health = fpsHealth(fps);

  return (
    <Surface level="elevated" padding="md" radius="md" style={styles.card}>
      <View style={styles.header}>
        <Text variant="label" tone="muted">
          JS Thread Frame Rate
        </Text>
        <Text variant="numericLarge" tone={TEXT_TONES[health]}>
          {fps} FPS
        </Text>
      </View>

      <MeterBar
        value={(Math.min(fps, FPS_CEILING) / FPS_CEILING) * 100}
        tone={METER_TONES[health]}
        height={sizes.meterBar}
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
