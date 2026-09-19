/**
 * Owns the lifetime of the single `MarketStreamClient`.
 *
 * There is exactly one socket for the whole app. Screens do not open their own
 * - they read the shared store and, where they need depth, declare a
 * subscription through `useDepthSubscription`. That keeps the gateway's client
 * count equal to the number of running apps rather than the number of mounted
 * screens, and it means navigating between tabs costs nothing.
 *
 * The client is put in a ref rather than state because it is a stable mutable
 * object, not a value that renders.
 */

import { ReactNode, createContext, useContext, useEffect, useRef } from "react";
import { marketStore } from "./marketStore";
import { MarketStreamClient } from "./MarketStreamClient";

const MarketStreamContext = createContext<MarketStreamClient | null>(null);

export const MarketStreamProvider = ({ children }: { children: ReactNode }) => {
  const clientRef = useRef<MarketStreamClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new MarketStreamClient(marketStore);
  }

  useEffect(() => {
    const client = clientRef.current;
    client?.start();
    return () => client?.stop();
  }, []);

  return (
    <MarketStreamContext.Provider value={clientRef.current}>
      {children}
    </MarketStreamContext.Provider>
  );
};

export const useMarketStream = (): MarketStreamClient => {
  const client = useContext(MarketStreamContext);
  if (!client) {
    throw new Error("useMarketStream must be used inside a MarketStreamProvider");
  }
  return client;
};
