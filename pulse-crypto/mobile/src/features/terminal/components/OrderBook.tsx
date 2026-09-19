/**
 * The bid/ask ladder (R18).
 *
 * Bids and asks stack with the mid price between them, which is the
 * conventional layout: the touch is in the middle and depth grows outwards, so
 * the spread is read at a glance rather than computed.
 *
 * Asks render **reversed** - worst price at the top, best just above the mid -
 * so that moving away from the mid always means moving away from the centre of
 * the screen on both sides.
 *
 * Rendered as plain `View`s rather than a `FlashList`: the book is a fixed 2x8
 * visible levels, so virtualisation would add a recycling layer and its
 * attendant key churn to a list that never scrolls. A list with a known, small,
 * constant length is the one case where virtualising is the wrong call.
 */

import { memo, useMemo } from "react";
import { View } from "react-native";
import { Text } from "@design-system";
import { Book } from "@protocol";
import { formatPrice } from "@utils";
import { accumulateLevels, totalVolume } from "../domain/orderBook";
import { styles } from "./OrderBook.styles";
import { OrderBookRow } from "./OrderBookRow";

/** Levels shown per side. The wire carries 20; eight fits without scrolling. */
const VISIBLE_LEVELS = 8;

export interface OrderBookProps {
  book: Book;
  priceDecimals: number;
  spread: number;
  spreadPct: number;
}

/**
 * Accumulation runs over the **full** 20 levels before slicing to the visible
 * eight, so the scale reflects the whole book. Scaling against only the
 * visible depth would make the eighth row always render at 100%, which would
 * look like a wall of liquidity that is not there.
 */
const visibleSide = (levels: Book["bids"]) => {
  const rows = accumulateLevels(levels);
  return { rows: rows.slice(0, VISIBLE_LEVELS), max: totalVolume(rows) };
};

export const OrderBook = memo(
  ({ book, priceDecimals, spread, spreadPct }: OrderBookProps) => {
    const bids = useMemo(() => visibleSide(book.bids), [book.bids]);
    const asks = useMemo(() => visibleSide(book.asks), [book.asks]);

    // One scale across both sides, so a visibly longer bar always means more
    // volume regardless of which side it is on.
    const maxCumulative = Math.max(bids.max, asks.max);

    if (book.bids.length === 0 && book.asks.length === 0) {
      return (
        <View style={styles.empty}>
          <Text variant="body" tone="muted">
            Waiting for order book
          </Text>
        </View>
      );
    }

    return (
      <View>
        <View style={styles.header}>
          <Text variant="label" tone="muted" style={styles.headerPrice}>
            Price
          </Text>
          <Text variant="label" tone="muted" style={styles.headerAmount}>
            Amount
          </Text>
          <Text variant="label" tone="muted" style={styles.headerTotal}>
            Total
          </Text>
        </View>

        {/* Reversed: best ask sits closest to the mid. */}
        {[...asks.rows].reverse().map(level => (
          <OrderBookRow
            key={`ask-${level.price}`}
            price={level.price}
            quantity={level.quantity}
            cumulative={level.cumulative}
            maxCumulative={maxCumulative}
            side="ask"
            priceDecimals={priceDecimals}
          />
        ))}

        <View style={styles.spread}>
          <Text variant="label" tone="muted">
            Spread
          </Text>
          <Text variant="numericSmall" tone="secondary">
            {formatPrice(spread, priceDecimals)} ({spreadPct.toFixed(3)}%)
          </Text>
        </View>

        {bids.rows.map(level => (
          <OrderBookRow
            key={`bid-${level.price}`}
            price={level.price}
            quantity={level.quantity}
            cumulative={level.cumulative}
            maxCumulative={maxCumulative}
            side="bid"
            priceDecimals={priceDecimals}
          />
        ))}
      </View>
    );
  },
);

OrderBook.displayName = "OrderBook";
