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
 * Rendered with `react-native-svg` rather than Reanimated. Unlike the order
 * book bars, the whole path geometry changes on every update, so there is no
 * single animatable property to hand to the UI thread - and at the ~10 Hz the
 * emitter delivers, re-rendering two `Path` elements is comfortably cheap. The
 * memo on the component plus the memo on the path strings means the work only
 * happens when the book actually changes.
 */

import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { Text, colors, spacing } from "@design-system";
import { Book, Level } from "@protocol";
import { formatPrice } from "@utils";

const CHART_HEIGHT = 120;

export interface MarketDepthProps {
  book: Book;
  priceDecimals: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Build an SVG area path for one side.
 *
 * The path walks the cumulative curve and then closes along the baseline, so
 * the fill is the area *under* the curve rather than a stroked line.
 */
const buildAreaPath = (points: Point[], baselineY: number): string => {
  if (points.length < 2) return "";

  const [first, ...rest] = points;
  if (!first) return "";

  const line = rest.map(point => `L ${point.x} ${point.y}`).join(" ");
  const last = points[points.length - 1];
  if (!last) return "";

  return `M ${first.x} ${baselineY} L ${first.x} ${first.y} ${line} L ${last.x} ${baselineY} Z`;
};

export const MarketDepth = memo(({ book, priceDecimals }: MarketDepthProps) => {
  const geometry = useMemo(() => {
    const bids = book.bids;
    const asks = book.asks;
    if (bids.length < 2 || asks.length < 2) return null;

    const bestBid = bids[0]?.[0] ?? 0;
    const bestAsk = asks[0]?.[0] ?? 0;
    if (bestBid <= 0 || bestAsk <= 0) return null;

    const midPrice = (bestBid + bestAsk) / 2;

    const cumulate = (levels: Level[]): { price: number; total: number }[] => {
      let running = 0;
      return levels.map(([price, quantity]) => {
        running += quantity;
        return { price, total: running };
      });
    };

    const bidCurve = cumulate(bids);
    const askCurve = cumulate(asks);

    const maxTotal = Math.max(
      bidCurve[bidCurve.length - 1]?.total ?? 0,
      askCurve[askCurve.length - 1]?.total ?? 0,
    );
    if (maxTotal <= 0) return null;

    // A symmetric price window around the mid, sized by whichever side reaches
    // further. Scaling each side independently would misrepresent the shape -
    // a wide-spread side would look artificially deep.
    const lowestBid = bidCurve[bidCurve.length - 1]?.price ?? midPrice;
    const highestAsk = askCurve[askCurve.length - 1]?.price ?? midPrice;
    const halfWindow = Math.max(midPrice - lowestBid, highestAsk - midPrice);
    if (halfWindow <= 0) return null;

    // Work in a 0-100 viewBox and let SVG scale it, so the geometry does not
    // depend on measuring the container.
    const toX = (price: number) => ((price - (midPrice - halfWindow)) / (halfWindow * 2)) * 100;
    const toY = (total: number) => CHART_HEIGHT - (total / maxTotal) * CHART_HEIGHT;

    // Bids are reversed so the path runs left-to-right like the asks, which
    // keeps `buildAreaPath` side-agnostic.
    const bidPoints = [...bidCurve]
      .reverse()
      .map(point => ({ x: toX(point.price), y: toY(point.total) }));
    const askPoints = askCurve.map(point => ({ x: toX(point.price), y: toY(point.total) }));

    return {
      bidPath: buildAreaPath(bidPoints, CHART_HEIGHT),
      askPath: buildAreaPath(askPoints, CHART_HEIGHT),
      midX: toX(midPrice),
      midPrice,
      maxTotal,
    };
  }, [book.bids, book.asks]);

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
        height={CHART_HEIGHT}
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Path d={geometry.bidPath} fill={colors.up.depth} stroke={colors.up.base} strokeWidth={0.4} />
        <Path
          d={geometry.askPath}
          fill={colors.down.depth}
          stroke={colors.down.base}
          strokeWidth={0.4}
        />
        <Line
          x1={geometry.midX}
          y1={0}
          x2={geometry.midX}
          y2={CHART_HEIGHT}
          stroke={colors.border.subtle}
          strokeWidth={0.4}
        />
      </Svg>
    </View>
  );
});

MarketDepth.displayName = "MarketDepth";

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  empty: {
    height: CHART_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});
