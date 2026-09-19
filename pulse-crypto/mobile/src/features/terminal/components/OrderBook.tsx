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
import { StyleSheet, View } from "react-native";
import { Text, colors, sizes, spacing } from "@design-system";
import { Book, Level } from "@protocol";
import { formatPrice } from "@utils";
import { OrderBookRow } from "./OrderBookRow";

/** Levels shown per side. The wire carries 20; eight fits without scrolling. */
const VISIBLE_LEVELS = 8;

export interface OrderBookProps {
  book: Book;
  priceDecimals: number;
  spread: number;
  spreadPct: number;
}

interface CumulativeLevel {
  price: number;
  quantity: number;
  cumulative: number;
}

/**
 * Accumulate outwards from the touch.
 *
 * Note this runs over the **full** 20 levels before slicing to the visible
 * eight, so `maxCumulative` reflects the whole book. Scaling the bars against
 * only the visible depth would make the eighth row always render at 100%,
 * which would look like a wall of liquidity that is not there.
 */
const accumulate = (levels: Level[]): { rows: CumulativeLevel[]; max: number } => {
  let running = 0;
  const rows: CumulativeLevel[] = levels.map(([price, quantity]) => {
    running += quantity;
    return { price, quantity, cumulative: running };
  });
  return { rows: rows.slice(0, VISIBLE_LEVELS), max: running };
};

export const OrderBook = memo(
  ({ book, priceDecimals, spread, spreadPct }: OrderBookProps) => {
    const bids = useMemo(() => accumulate(book.bids), [book.bids]);
    const asks = useMemo(() => accumulate(book.asks), [book.asks]);

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

const styles = StyleSheet.create({
  header: {
    height: sizes.orderBookHeader,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerPrice: { flex: 1, textAlign: "left" },
  headerAmount: { flex: 1, textAlign: "center" },
  headerTotal: { flex: 1, textAlign: "right" },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    marginVertical: spacing.xs,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
});
