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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { ConnectionBanner, TopAppBar } from "@components";
import { SearchField, Text, colors, durations } from "@design-system";
import { PairMeta } from "@protocol";
import { useSortedPairs, useStreamPairs } from "@realtime";
import {
  useAppDispatch,
  useFavourites,
  useGetPairsMetaQuery,
  toggleFavourite,
} from "@store";
import { MarketRow } from "./components/MarketRow";
import { REFRESH_COLOURS, styles } from "./MarketsScreen.styles";

const keyExtractor = (pair: string) => pair;

export const MarketsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const favourites = useFavourites();
  const streamPairs = useStreamPairs();
  const [query, setQuery] = useState("");

  const { data, refetch } = useGetPairsMetaQuery();

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
    (pair: string) => navigation.navigate("Terminal", { pair }),
    [navigation],
  );

  const handleToggleFavourite = useCallback(
    (pair: string) => dispatch(toggleFavourite(pair)),
    [dispatch],
  );

  // The spinner is driven by local state rather than by `isFetching`, because
  // the gateway answers in about a millisecond and a spinner that never
  // survives a frame reads as a dead gesture. It is held for
  // `durations.refreshFloor`, which is also what makes R27 observable: prices
  // have to keep ticking *underneath* something.
  //
  // A failed refetch is already reflected in the query's `isError`, so the
  // result is deliberately discarded rather than handled twice.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const spinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    const startedAt = Date.now();
    void refetch().finally(() => {
      const remaining = durations.refreshFloor - (Date.now() - startedAt);
      spinnerTimer.current = setTimeout(() => setIsRefreshing(false), Math.max(0, remaining));
    });
  }, [refetch]);

  const byPair: Record<string, PairMeta> | undefined = data?.byPair;

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <MarketRow
        pair={item}
        meta={byPair?.[item]}
        isFavourite={favourites.includes(item)}
        onPress={handlePress}
        onToggleFavourite={handleToggleFavourite}
      />
    ),
    [byPair, favourites, handlePress, handleToggleFavourite],
  );

  return (
    <View style={styles.screen}>
      <TopAppBar title="Markets" subtitle="Watchlist" />

      <View style={styles.search}>
        <SearchField value={query} onChangeText={setQuery} />
      </View>

      <ConnectionBanner />

      <FlashList
        data={visiblePairs}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        // R27: pull-to-refresh reloads metadata only. The WebSocket is a
        // separate transport and is never touched, so prices keep ticking
        // underneath the spinner - which is the behaviour the brief asks for
        // and is invisible unless you look for it.
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand}
            colors={REFRESH_COLOURS}
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
