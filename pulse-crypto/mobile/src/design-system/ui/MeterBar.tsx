/**
 * The style guide's meter bar, used for buy/sell pressure (R18).
 *
 * The fill animates on the **UI thread** via Reanimated rather than through
 * React state. Pressure updates arrive with every depth frame, so a state-driven
 * width would re-render this component ten times a second and animate on the
 * same thread that has to answer touches. With a shared value the JS thread
 * hands over a number and the animation runs regardless of how busy JS is -
 * which is the behaviour R20 is asking about.
 */

import { memo, useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { durations } from "../tokens/motion";
import { sizes } from "../tokens/spacing";
import { MeterTone, styles, toneStyles } from "./MeterBar.styles";

export type { MeterTone };

export interface MeterBarProps {
  /** 0-100. Clamped, because a derived percentage should never break layout. */
  value: number;
  tone?: MeterTone;
  height?: number;
  accessibilityLabel?: string;
}

export const MeterBar = memo(
  ({ value, tone = "up", height = sizes.sliderTrack, accessibilityLabel }: MeterBarProps) => {
    const progress = useSharedValue(clamp(value));

    useEffect(() => {
      progress.value = withTiming(clamp(value), { duration: durations.meter });
    }, [progress, value]);

    const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));
    // The one genuinely caller-driven dimension. Memoised so a pressure tick
    // does not allocate a style object on every frame.
    const heightStyle = useMemo(() => ({ height }), [height]);

    return (
      <View
        style={[styles.track, heightStyle]}
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(value)) }}
      >
        <Animated.View style={[styles.fill, toneStyles[tone], fillStyle]} />
      </View>
    );
  },
);

MeterBar.displayName = "MeterBar";

const clamp = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
};
