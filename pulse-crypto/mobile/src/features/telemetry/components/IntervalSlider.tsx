/**
 * The mockup's "Update Frequency" slider, wired to the gateway's emit interval
 * (R5).
 *
 * This is the control that makes the configurable-interval requirement
 * visible: drag it and the emit rate on the card above tracks it live, because
 * the value goes over the WebSocket and retunes the server's `setInterval`.
 *
 * The position/interval conversion lives in `../domain/scales`; this file is
 * the gesture and the layout.
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

import { memo, useCallback, useEffect, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Surface, Text, sizes } from "@design-system";
import {
  INTERVAL_MAX_MS,
  INTERVAL_MIN_MS,
  toMs,
  toRatio,
} from "../domain/scales";
import { styles } from "./IntervalSlider.styles";

/** Lifted to a plain number so the Reanimated worklet captures a primitive. */
const THUMB_SIZE = sizes.sliderThumb;

export interface IntervalSliderProps {
  /** Current server-side interval, in ms. */
  value: number;
  /** Called on release with the chosen interval. */
  onCommit: (ms: number) => void;
}

export const IntervalSlider = memo(({ value, onCommit }: IntervalSliderProps) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const [displayMs, setDisplayMs] = useState(value);

  const ratio = useSharedValue(toRatio(value));
  const dragStartRatio = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  // `toRatio` and `toMs` are ordinary functions, so they exist only on the JS
  // runtime. Calling one from inside a worklet throws "tried to synchronously
  // call a remote function". So every conversion happens on this side, and the
  // worklets below deal only in 0-1 ratios and shared values.
  const serverRatio = toRatio(value);

  const showRatio = useCallback((next: number) => {
    setDisplayMs(toMs(next));
  }, []);

  const commitRatio = useCallback(
    (next: number) => {
      onCommit(toMs(next));
    },
    [onCommit],
  );

  // While the user is not dragging, follow the server. This is what makes the
  // control correct with two clients connected: the interval is global, so if
  // another device moves it, this thumb should move too.
  //
  // A plain effect rather than a worklet: `value` only moves when a `config`
  // frame arrives, which is rare and not per-frame, so nothing here needs the
  // UI thread. Writing a shared value from JS is supported, and the drag
  // itself stays on the UI thread either way.
  useEffect(() => {
    if (!isDragging.value) ratio.value = serverRatio;
  }, [serverRatio, isDragging, ratio]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      isDragging.value = true;
      dragStartRatio.value = ratio.value;
    })
    .onUpdate(event => {
      if (trackWidth <= 0) return;
      const next = dragStartRatio.value + event.translationX / trackWidth;
      ratio.value = Math.min(1, Math.max(0, next));
      runOnJS(showRatio)(ratio.value);
    })
    .onEnd(() => {
      isDragging.value = false;
      runOnJS(commitRatio)(ratio.value);
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
          {INTERVAL_MIN_MS} ms
        </Text>
        <Text variant="caption" tone="muted">
          {INTERVAL_MAX_MS} ms
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
