/**
 * One order book level (R18, R23).
 *
 * Measured from mockup node `1:39`: 32pt tall, 8pt horizontal padding, three
 * equal columns - price left in the side colour, amount centred, total right
 * in secondary.
 *
 * ## The depth bar
 *
 * An absolutely positioned overlay with `inset: 0 0 0 X%` - anchored to the
 * right edge and growing leftward as cumulative volume rises. That single
 * `left` percentage is the **only** thing that animates, which makes it an
 * ideal `useAnimatedStyle` target: the bar interpolates on the UI thread while
 * the text updates through the keyed store, and neither blocks the other.
 *
 * `withTiming` rather than a direct assignment is what satisfies "order book
 * volume changes should animate smoothly" (R23) - without it the bar would
 * snap between widths ten times a second, which reads as flicker rather than
 * as depth changing.
 */

import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Text, colors, durations, sizes, spacing } from "@design-system";
import { formatPrice, formatQuantity } from "@utils";

export interface OrderBookRowProps {
  price: number;
  quantity: number;
  /** Running total from the top of the book to this level. */
  cumulative: number;
  /** Largest cumulative on this side, used to scale the bar to 0-100%. */
  maxCumulative: number;
  side: "bid" | "ask";
  priceDecimals: number;
}

export const OrderBookRow = memo(
  ({ price, quantity, cumulative, maxCumulative, side, priceDecimals }: OrderBookRowProps) => {
    const fillRatio =
      maxCumulative > 0 ? Math.min(1, cumulative / maxCumulative) : 0;
    // `left` is the inverse of the fill: 100% left inset means a zero-width
    // bar, 0% means full width.
    const left = useSharedValue((1 - fillRatio) * 100);

    useEffect(() => {
      left.value = withTiming((1 - fillRatio) * 100, { duration: durations.depthBar });
    }, [fillRatio, left]);

    const barStyle = useAnimatedStyle(() => ({ left: `${left.value}%` }));

    return (
      <View style={styles.row}>
        <Animated.View
          style={[
            styles.depthBar,
            { backgroundColor: side === "bid" ? colors.up.fill : colors.down.fill },
            barStyle,
          ]}
          // Decorative: the numbers beside it already carry the information.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        <Text
          variant="numeric"
          tone={side === "bid" ? "up" : "down"}
          style={styles.price}
          numberOfLines={1}
        >
          {formatPrice(price, priceDecimals)}
        </Text>
        <Text variant="numeric" tone="primary" style={styles.amount} numberOfLines={1}>
          {formatQuantity(quantity)}
        </Text>
        <Text variant="numeric" tone="secondary" style={styles.total} numberOfLines={1}>
          {formatQuantity(cumulative)}
        </Text>
      </View>
    );
  },
);

OrderBookRow.displayName = "OrderBookRow";

const styles = StyleSheet.create({
  row: {
    height: sizes.orderBookRow,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  depthBar: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
  },
  price: {
    flex: 1,
    textAlign: "left",
  },
  amount: {
    flex: 1,
    textAlign: "center",
  },
  total: {
    flex: 1,
    textAlign: "right",
  },
});
