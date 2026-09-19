/**
 * The trading terminal: the detail view for one pair (R18).
 *
 * The pair comes from navigation params when arrived at from the watchlist,
 * and defaults to the first available pair when the tab is opened directly -
 * so the screen is never empty, which matters because it is the app's initial
 * route.
 *
 * `useDepthSubscription` is the only place depth is requested. It subscribes on
 * mount and releases on unmount, so the gateway is serialising an order book
 * for this client only while this screen is actually showing one.
 */

import { useCallback, useMemo } from "react";
import { ScrollView, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { ConnectionBanner, TopAppBar } from "@components";
import { IconButton, Text } from "@design-system";
import { TabParamList } from "@navigation";
import {
  useClockTick,
  useDepthSubscription,
  useOrderBook,
  useStreamPairs,
  useTicker,
} from "@realtime";
import {
  toggleFavourite,
  useAppDispatch,
  useGetPairsMetaQuery,
  useIsFavourite,
} from "@store";
import { formatRelativeTime } from "@utils";
import { MarketDepth } from "./components/MarketDepth";
import { OrderBook } from "./components/OrderBook";
import { PressurePanel } from "./components/PressurePanel";
import { PriceTicker } from "./components/PriceTicker";
import { styles } from "./TerminalScreen.styles";

const FAVOURITE_ON = "\u2605";
const FAVOURITE_OFF = "\u2606";

export const TerminalScreen = () => {
  const route = useRoute<RouteProp<TabParamList, "Terminal">>();
  const dispatch = useAppDispatch();
  const streamPairs = useStreamPairs();
  const { data } = useGetPairsMetaQuery();

  const availablePairs = data?.order.length ? data.order : streamPairs;
  const pair = route.params?.pair ?? availablePairs[0] ?? "";

  // R18: depth for this pair only, for as long as this screen is mounted.
  useDepthSubscription(pair || null);

  const ticker = useTicker(pair);
  const book = useOrderBook(pair);
  const meta = data?.byPair[pair];
  const isFavourite = useIsFavourite(pair);

  // "Updated Ns ago" is a function of the clock, not of the data, so it needs
  // its own 1 Hz tick - otherwise it would freeze at "0s ago" the moment the
  // stream stopped, which is exactly when it needs to be moving.
  const now = useClockTick();
  const lastUpdated = useMemo(
    () => formatRelativeTime(ticker.timestamp, now),
    [ticker.timestamp, now],
  );

  const handleToggleFavourite = useCallback(() => {
    if (pair) dispatch(toggleFavourite(pair));
  }, [dispatch, pair]);

  if (!pair) {
    return (
      <View style={styles.screen}>
        <TopAppBar title="Terminal" />
        <View style={styles.empty}>
          <Text variant="body" tone="muted">
            Waiting for the market feed
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TopAppBar
        title={meta?.displayName ?? pair}
        subtitle={`Updated ${lastUpdated}`}
        trailing={
          <IconButton
            onPress={handleToggleFavourite}
            accessibilityLabel={
              isFavourite ? `Remove ${pair} from favourites` : `Add ${pair} to favourites`
            }
            accessibilityState={{ checked: isFavourite }}
          >
            <Text variant="title" tone={isFavourite ? "brand" : "muted"}>
              {isFavourite ? FAVOURITE_ON : FAVOURITE_OFF}
            </Text>
          </IconButton>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <ConnectionBanner />

        <PriceTicker ticker={ticker} meta={meta} />

        <PressurePanel
          buyPressure={ticker.buyPressure}
          sellPressure={ticker.sellPressure}
          spread={ticker.spread}
          spreadPct={ticker.spreadPct}
          priceDecimals={meta?.priceDecimals ?? 2}
        />

        <MarketDepth book={book} priceDecimals={meta?.priceDecimals ?? 2} />

        <View style={styles.section}>
          <Text variant="label" tone="muted" style={styles.sectionTitle}>
            Order Book
          </Text>
          <OrderBook
            book={book}
            priceDecimals={meta?.priceDecimals ?? 2}
            spread={ticker.spread}
            spreadPct={ticker.spreadPct}
          />
        </View>
      </ScrollView>
    </View>
  );
};
