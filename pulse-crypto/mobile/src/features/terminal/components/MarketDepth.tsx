/**
 * The cumulative market-depth chart.
 *
 * This is the mockup's "Shader" node (`1:2`) decoded: a green area filling
 * leftward from the mid and a pink one filling rightward, split by a thin
 * vertical line. It looks like decoration in the Figma file and is not - it is
 * a standard depth chart, and every value in it is derivable from the top-20
 * book already on the wire.
 *
 * Read it as: "how much volume is available between the mid price and this
 * price". A steep near-vertical wall close to the mid means thin liquidity; a
 * long shallow slope means the book absorbs size without moving much.
 *
 * The projection maths lives in `../domain/orderBook`, so this component
 * only turns geometry into SVG elements.
 *
 * Rendered with `react-native-svg` rather than Reanimated. Unlike the order
 * book bars, the whole path geometry changes on every update, so there is no
 * single animatable property to hand to the UI thread - and at the ~10 Hz the
 * emitter delivers, re-rendering two `Path` elements is comfortably cheap. The
 * memo on the component plus the memo on the geometry means the work only
 * happens when the book actually changes.
 */

import { memo, useMemo } from "react";
import { View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { Text, borderWidth, colors, sizes } from "@design-system";
import { Book } from "@protocol";
import { formatPrice } from "@utils";
import { buildDepthGeometry } from "../domain/orderBook";
import { styles } from "./MarketDepth.styles";

export interface MarketDepthProps {
  book: Book;
  priceDecimals: number;
}

export const MarketDepth = memo(({ book, priceDecimals }: MarketDepthProps) => {
  // Destructured so the memo keys on the two arrays rather than the wrapper
  // object: a new `book` carrying the same sides must not recompute.
  const { bids, asks } = book;
  const geometry = useMemo(
    () => buildDepthGeometry({ bids, asks }, sizes.depthChart),
    [bids, asks],
  );

  if (!geometry) {
    return (
      <View style={styles.empty}>
        <Text variant="body" tone="muted">
          Waiting for depth
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="label" tone="muted">
          Market Depth
        </Text>
        <Text variant="numericSmall" tone="secondary">
          mid {formatPrice(geometry.midPrice, priceDecimals)}
        </Text>
      </View>

      <Svg
        width="100%"
        height={sizes.depthChart}
        viewBox={`0 0 100 ${sizes.depthChart}`}
        preserveAspectRatio="none"
      >
        <Path
          d={geometry.bidPath}
          fill={colors.up.depth}
          stroke={colors.up.base}
          strokeWidth={borderWidth.chartStroke}
        />
        <Path
          d={geometry.askPath}
          fill={colors.down.depth}
          stroke={colors.down.base}
          strokeWidth={borderWidth.chartStroke}
        />
        <Line
          x1={geometry.midX}
          y1={0}
          x2={geometry.midX}
          y2={sizes.depthChart}
          stroke={colors.border.subtle}
          strokeWidth={borderWidth.chartStroke}
        />
      </Svg>
    </View>
  );
});

MarketDepth.displayName = "MarketDepth";
