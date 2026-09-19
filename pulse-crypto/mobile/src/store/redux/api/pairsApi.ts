/**
 * `GET /pairs/meta` (R11, R12, R27).
 *
 * Metadata is the one piece of server state that belongs in RTK Query: it is
 * requested, cached, and occasionally refetched. `refetch()` is what
 * pull-to-refresh calls, and because the WebSocket is a completely separate
 * transport, refreshing metadata cannot interrupt the price stream - which is
 * exactly what R27 asks for.
 *
 * The response is normalised into a `Record` keyed by pair. Rows look
 * metadata up by pair on every render, and an O(n) `find` per row per render
 * would be a small but entirely avoidable cost on the hot path.
 */

import { PairMeta } from "@protocol";
import { api } from "./baseApi";

interface PairsMetaResponse {
  pairs: PairMeta[];
  serverTime: number;
}

export interface NormalizedPairsMeta {
  /** Server-declared display order. The watchlist renders in this order. */
  order: string[];
  byPair: Record<string, PairMeta>;
  serverTime: number;
}

/**
 * Exported for its own test: this is the seam where a malformed or partial
 * response would otherwise become a crash in a list row.
 */
export const normalizePairsMeta = (response: PairsMetaResponse): NormalizedPairsMeta => {
  const byPair: Record<string, PairMeta> = {};
  const order: string[] = [];

  for (const meta of response.pairs ?? []) {
    if (!meta?.pair) continue;
    byPair[meta.pair] = meta;
    order.push(meta.pair);
  }

  return { order, byPair, serverTime: response.serverTime ?? 0 };
};

export const pairsApi = api.injectEndpoints({
  endpoints: builder => ({
    getPairsMeta: builder.query<NormalizedPairsMeta, void>({
      query: () => "/pairs/meta",
      transformResponse: normalizePairsMeta,
      providesTags: ["PairMeta"],
    }),
  }),
});

export const { useGetPairsMetaQuery } = pairsApi;
