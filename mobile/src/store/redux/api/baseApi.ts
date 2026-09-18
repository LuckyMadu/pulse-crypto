/**
 * The RTK Query root. Endpoints are injected by feature slices rather than
 * declared here, which keeps this file free of domain knowledge.
 *
 * There is no auth layer, unlike the equivalent file in the Aumedix apps this
 * pattern is borrowed from - the gateway serves public market data and holds no
 * credentials. Worth noting rather than leaving as an unexplained absence.
 */

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { config } from "@config";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: config.api.baseUrl,
    timeout: config.api.timeoutMs,
    prepareHeaders: headers => {
      headers.set("Accept", "application/json");
      return headers;
    },
  }),
  tagTypes: ["PairMeta"] as const,
  endpoints: () => ({}),
});
