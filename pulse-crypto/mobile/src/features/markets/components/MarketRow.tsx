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
 * and two callbacks, all stable, so a parent re-render costs nothing. The two
 * press handlers are wrapped rather than written inline for the same reason -
 * an inline arrow would hand `Pressable` a new reference on every tick.
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

import { memo, useCallback, useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LiveDot } from "@components";
import { Text, colors, durations, sizes } from "@design-system";
import { PairMeta } from "@protocol";
import { useTicker } from "@realtime";
import { formatPercent, formatPrice } from "@utils";
import { styles } from "./MarketRow.styles";

export interface MarketRowProps {
  pair: string;
  meta?: PairMeta;
  isFavourite: boolean;
  onPress: (pair: string) => void;
  onToggleFavourite: (pair: string) => void;
}

const FAVOURITE_ON = "\u2605";
const FAVOURITE_OFF = "\u2606";

/** Fallback when metadata has not arrived; most USDT pairs quote to 2dp. */
const DEFAULT_PRICE_DECIMALS = 2;

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

    const handlePress = useCallback(() => onPress(pair), [onPress, pair]);
    const handleToggleFavourite = useCallback(
      () => onToggleFavourite(pair),
      [onToggleFavourite, pair],
    );

    const changeTone = ticker.change24hPct >= 0 ? "up" : "down";
    const decimals = meta?.priceDecimals ?? DEFAULT_PRICE_DECIMALS;
    const hasTicked = ticker.timestamp !== 0;

    return (
      <Pressable
        onPress={handlePress}
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
              {hasTicked ? formatPrice(ticker.price, decimals) : "--"}
            </Text>
            <Text variant="numericSmall" tone={changeTone}>
              {hasTicked ? formatPercent(ticker.change24hPct) : "--"}
            </Text>
          </View>

          <Pressable
            onPress={handleToggleFavourite}
            hitSlop={sizes.hitSlop}
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
