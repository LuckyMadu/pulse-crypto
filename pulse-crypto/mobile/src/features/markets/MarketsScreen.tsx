/**
 * The watchlist (R12-R17, R27).
 *
 * The screen's job is deliberately small: decide *which* rows exist and in what
 * order. It never touches prices. Every price on this screen is read by the row
 * that displays it, straight from the external store - which is why the list
 * does not re-render when the market moves, only when the filter, the
 * favourites, or the metadata change.
 *
 * Pair order comes from `/pairs/meta` when available and falls back to the
 * WebSocket snapshot, so the list populates even if the REST call is slow or
 * fails - a socket that is up is enough to render the screen.
 */

import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { ConnectionBanner, TopAppBar } from "@components";
import { SearchField, Text, colors, sizes, spacing } from "@design-system";
import { useSortedPairs, useStreamPairs } from "@realtime";
import {
  useAppDispatch,
  useFavourites,
  useGetPairsMetaQuery,
  toggleFavourite,
} from "@store";
import { MarketRow } from "./components/MarketRow";

export const MarketsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const favourites = useFavourites();
  const streamPairs = useStreamPairs();
  const [query, setQuery] = useState("");

  const { data, isFetching, refetch } = useGetPairsMetaQuery();

  // Prefer the REST order; fall back to whatever the socket has told us.
  const allPairs = data?.order.length ? data.order : streamPairs;
  const sortedPairs = useSortedPairs(allPairs, favourites);

  // R14. Matches the symbol and the display name, so both "btc" and "btc/u"
  // work. Uppercased once rather than per row.
  const visiblePairs = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) return sortedPairs;
    return sortedPairs.filter(pair => {
      const displayName = data?.byPair[pair]?.displayName ?? pair;
      return pair.includes(needle) || displayName.toUpperCase().includes(needle);
    });
  }, [data?.byPair, query, sortedPairs]);

  const handlePress = useCallback(
    (pair: string) => navigation.navigate("Tabs", { screen: "Terminal", params: { pair } }),
    [navigation],
  );

  const handleToggleFavourite = useCallback(
    (pair: string) => dispatch(toggleFavourite(pair)),
    [dispatch],
  );

  // `refetch` returns a promise that `RefreshControl` will not await. A failed
  // refetch is already reflected in the query's `isError`, so the result is
  // deliberately discarded rather than handled twice.
  const handleRefresh = useCallback(() => void refetch(), [refetch]);

  return (
    <View style={styles.screen}>
      <TopAppBar title="Markets" subtitle="Watchlist" />

      <View style={styles.search}>
        <SearchField value={query} onChangeText={setQuery} />
      </View>

      <ConnectionBanner />

      <FlashList
        data={visiblePairs}
        keyExtractor={pair => pair}
        renderItem={({ item }) => (
          <MarketRow
            pair={item}
            meta={data?.byPair[item]}
            isFavourite={favourites.includes(item)}
            onPress={handlePress}
            onToggleFavourite={handleToggleFavourite}
          />
        )}
        // R27: pull-to-refresh reloads metadata only. The WebSocket is a
        // separate transport and is never touched, so prices keep ticking
        // underneath the spinner - which is the behaviour the brief asks for
        // and is invisible unless you look for it.
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={handleRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.bg.elevated}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="body" tone="muted">
              {query ? `No pairs matching "${query}"` : "Waiting for market data"}
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  search: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  list: {
    paddingBottom: sizes.bottomNav,
  },
  empty: {
    padding: spacing.xl,
    alignItems: "center",
  },
});
