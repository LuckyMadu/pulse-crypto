/**
 * The large price block at the top of the Terminal screen (R18, R21, R22).
 *
 * The flash here tints the **text** rather than a background, unlike the
 * watchlist row. At 32pt a full-width background flash is overwhelming ten
 * times a second; at list-row size a text-only tint is too subtle to notice.
 * Same signal, different scale, so a different treatment.
 */

import { memo, useEffect } from "react";
import { View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Chip, Text, colors, durations } from "@design-system";
import { PairMeta } from "@protocol";
import { Ticker } from "@realtime";
import { formatCompact, formatPercent, formatPrice } from "@utils";
import { styles } from "./PriceTicker.styles";

/** Fallback when metadata has not arrived; most USDT pairs quote to 2dp. */
const DEFAULT_PRICE_DECIMALS = 2;

export interface PriceTickerProps {
  ticker: Ticker;
  meta?: PairMeta;
}

export const PriceTicker = memo(({ ticker, meta }: PriceTickerProps) => {
  const flash = useSharedValue(0);
  const decimals = meta?.priceDecimals ?? DEFAULT_PRICE_DECIMALS;

  useEffect(() => {
    if (!ticker.direction || ticker.revision === 0) return;
    flash.value = withSequence(
      withTiming(ticker.direction === "up" ? 1 : -1, { duration: durations.flashIn }),
      withTiming(0, { duration: durations.flashOut }),
    );
  }, [flash, ticker.revision, ticker.direction]);

  const priceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      flash.value,
      [-1, 0, 1],
      [colors.down.text, colors.text.primary, colors.up.text],
    ),
  }));

  const changeTone = ticker.change24hPct >= 0 ? "up" : "down";

  return (
    <View style={styles.container}>
      <View style={styles.priceRow}>
        <Animated.Text style={[styles.price, priceStyle]}>
          {ticker.timestamp === 0 ? "--" : formatPrice(ticker.price, decimals)}
        </Animated.Text>
        <Chip label={formatPercent(ticker.change24hPct)} tone={changeTone} />
      </View>

      <View style={styles.stats}>
        <Stat label="24h High" value={formatPrice(meta?.high24h ?? 0, decimals)} />
        <Stat label="24h Low" value={formatPrice(meta?.low24h ?? 0, decimals)} />
        {/* Mocked from a static supply table - Binance publishes no supply. */}
        <Stat label="Market Cap" value={formatCompact(meta?.marketCapUsd ?? null)} />
      </View>
    </View>
  );
});

PriceTicker.displayName = "PriceTicker";

const Stat = memo(({ label, value }: { label: string; value: string }) => (
  <View style={styles.stat}>
    <Text variant="label" tone="muted">
      {label}
    </Text>
    <Text variant="numericSmall" tone="secondary">
      {value}
    </Text>
  </View>
));

Stat.displayName = "Stat";
