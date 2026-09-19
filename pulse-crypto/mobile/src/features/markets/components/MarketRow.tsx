/**
 * One watchlist row (R13, R21, R22).
 *
 * ## Why the row subscribes rather than receiving props
 *
 * The row reads its own pair from the external store through `useTicker`. The
 * alternative - the screen subscribing once and passing prices down - would
 * re-render the entire list on every tick, because the list's data array would
 * change identity 50 times a second. Here the list renders once and each row
 * independently wakes only when *its* pair moves.
 *
 * `React.memo` then does real work: the props are the pair name, the metadata
 * and two callbacks, all stable, so a parent re-render costs nothing.
 *
 * ## Why the flash is Reanimated and not state
 *
 * The green/red highlight runs on the UI thread as a background-colour
 * interpolation driven by a shared value. Done with `useState` plus a
 * `setTimeout` it would schedule two extra React renders per tick per row -
 * 100 renders a second across five rows - on the same thread that has to stay
 * responsive to touches. This is the difference the Telemetry screen's FPS
 * gauge is there to show.
 */

import { memo, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LiveDot } from "@components";
import {
  Text,
  colors,
  durations,
  radii,
  sizes,
  spacing,
} from "@design-system";
import { PairMeta } from "@protocol";
import { useTicker } from "@realtime";
import { formatPercent, formatPrice } from "@utils";

export interface MarketRowProps {
  pair: string;
  meta?: PairMeta;
  isFavourite: boolean;
  onPress: (pair: string) => void;
  onToggleFavourite: (pair: string) => void;
}

const FAVOURITE_ON = "\u2605";
const FAVOURITE_OFF = "\u2606";

export const MarketRow = memo(
  ({ pair, meta, isFavourite, onPress, onToggleFavourite }: MarketRowProps) => {
    const ticker = useTicker(pair);
    const flash = useSharedValue(0);

    // Keyed on `revision` rather than `price`: a tick that arrives with an
    // unchanged price still counts as activity, and depending on the price
    // would silently skip the effect in that case.
    useEffect(() => {
      if (!ticker.direction || ticker.revision === 0) return;
      flash.value = withSequence(
        withTiming(ticker.direction === "up" ? 1 : -1, { duration: durations.flashIn }),
        withTiming(0, { duration: durations.flashOut }),
      );
    }, [flash, ticker.revision, ticker.direction]);

    const flashStyle = useAnimatedStyle(() => ({
      backgroundColor: interpolateColor(
        flash.value,
        [-1, 0, 1],
        [colors.down.fill, colors.bg.row, colors.up.fill],
      ),
    }));

    const changeTone = ticker.change24hPct >= 0 ? "up" : "down";
    const decimals = meta?.priceDecimals ?? 2;

    return (
      <Pressable
        onPress={() => onPress(pair)}
        accessibilityRole="button"
        accessibilityLabel={`${meta?.displayName ?? pair}, ${formatPrice(ticker.price, decimals)}`}
      >
        <Animated.View style={[styles.row, flashStyle]}>
          <View style={styles.identity}>
            <View style={styles.pairLine}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {meta?.displayName ?? pair}
              </Text>
              {/* R13: the live indicator is per row, not only in the app bar. */}
              <LiveDot timestamp={ticker.timestamp} revision={ticker.revision} />
            </View>
            <Text variant="label" tone="muted">
              {meta?.baseAsset ?? pair.replace("USDT", "")}
            </Text>
          </View>

          <View style={styles.values}>
            <Text variant="numeric" tone="primary">
              {ticker.timestamp === 0 ? "--" : formatPrice(ticker.price, decimals)}
            </Text>
            <Text variant="numericSmall" tone={changeTone}>
              {ticker.timestamp === 0 ? "--" : formatPercent(ticker.change24hPct)}
            </Text>
          </View>

          <Pressable
            onPress={() => onToggleFavourite(pair)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityState={{ checked: isFavourite }}
            accessibilityLabel={
              isFavourite ? `Remove ${pair} from favourites` : `Add ${pair} to favourites`
            }
            style={styles.favourite}
          >
            <Text variant="title" tone={isFavourite ? "brand" : "muted"}>
              {isFavourite ? FAVOURITE_ON : FAVOURITE_OFF}
            </Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    );
  },
);

MarketRow.displayName = "MarketRow";

const styles = StyleSheet.create({
  row: {
    height: sizes.marketRow,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    gap: spacing.xxs,
  },
  pairLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  values: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  favourite: {
    width: 32,
    alignItems: "flex-end",
  },
});
