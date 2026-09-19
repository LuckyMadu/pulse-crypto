/**
 * The mockup's "Update Frequency" slider, wired to the gateway's emit interval
 * (R5).
 *
 * This is the control that makes the configurable-interval requirement
 * visible: drag it and the emit rate on the card above tracks it live, because
 * the value goes over the WebSocket and retunes the server's `setInterval`.
 *
 * ## Built rather than installed
 *
 * `@react-native-community/slider` would do this, but it would be a native
 * dependency added for one control - and the thumb would then be driven by
 * JS-side state anyway. A Reanimated `Pan` gesture keeps the drag entirely on
 * the UI thread, so the thumb tracks the finger even while JS is parsing a
 * 2000 msg/s stream. On this screen in particular, a thumb that stutters under
 * load would undercut the exact claim the screen exists to demonstrate.
 *
 * ## Committing on release, not during the drag
 *
 * `onChange` fires continuously on the UI thread for the label, but the
 * gateway is only told on release. Sending mid-drag would push a `config`
 * broadcast to every client on every frame of the gesture, and retuning a
 * `setInterval` sixty times a second is pointless churn.
 */

import { memo, useCallback, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { config } from "@config";
import { Surface, Text, colors, radii, spacing } from "@design-system";

const THUMB_SIZE = 22;
const TRACK_HEIGHT = 6;
/** Snap granularity, so the label does not read 237ms. */
const STEP_MS = 10;

export interface IntervalSliderProps {
  /** Current server-side interval, in ms. */
  value: number;
  /** Called on release with the chosen interval. */
  onCommit: (ms: number) => void;
}

const { min: MIN_MS, max: MAX_MS } = config.emitIntervalRange;

const toRatio = (ms: number): number => (ms - MIN_MS) / (MAX_MS - MIN_MS);

const toMs = (ratio: number): number => {
  const raw = MIN_MS + ratio * (MAX_MS - MIN_MS);
  return Math.min(MAX_MS, Math.max(MIN_MS, Math.round(raw / STEP_MS) * STEP_MS));
};

export const IntervalSlider = memo(({ value, onCommit }: IntervalSliderProps) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const [displayMs, setDisplayMs] = useState(value);

  const ratio = useSharedValue(toRatio(value));
  const dragStartRatio = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  // While the user is not dragging, follow the server. This is what makes the
  // control correct with two clients connected: the interval is global, so if
  // another device moves it, this thumb should move too.
  useDerivedValue(() => {
    if (!isDragging.value) ratio.value = toRatio(value);
  }, [value]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      isDragging.value = true;
      dragStartRatio.value = ratio.value;
    })
    .onUpdate(event => {
      if (trackWidth <= 0) return;
      const next = dragStartRatio.value + event.translationX / trackWidth;
      ratio.value = Math.min(1, Math.max(0, next));
      runOnJS(setDisplayMs)(toMs(ratio.value));
    })
    .onEnd(() => {
      isDragging.value = false;
      runOnJS(onCommit)(toMs(ratio.value));
    })
    .onFinalize(() => {
      isDragging.value = false;
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ratio.value * Math.max(0, trackWidth - THUMB_SIZE) }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: ratio.value * trackWidth,
  }));

  return (
    <Surface level="elevated" padding="md" radius="md" style={styles.card}>
      <View style={styles.header}>
        <Text variant="label" tone="muted">
          Update Frequency
        </Text>
        <Text variant="numericLarge" tone="brand">
          {displayMs} ms
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.touchArea}>
          <View style={styles.track} onLayout={handleLayout}>
            <Animated.View style={[styles.fill, fillStyle]} />
            <Animated.View style={[styles.thumb, thumbStyle]} />
          </View>
        </View>
      </GestureDetector>

      <View style={styles.bounds}>
        <Text variant="caption" tone="muted">
          {MIN_MS} ms
        </Text>
        <Text variant="caption" tone="muted">
          {MAX_MS} ms
        </Text>
      </View>

      <Text variant="caption" tone="muted">
        Retunes the gateway&apos;s emitter. The interval is shared across clients,
        and the server clamps anything outside this range.
      </Text>
    </Surface>
  );
});

IntervalSlider.displayName = "IntervalSlider";

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  touchArea: {
    // The visible track is 6pt tall; the gesture target must not be.
    paddingVertical: spacing.md,
    justifyContent: "center",
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: colors.bg.row,
    borderRadius: radii.pill,
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    height: TRACK_HEIGHT,
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.bg.elevated,
  },
  bounds: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
