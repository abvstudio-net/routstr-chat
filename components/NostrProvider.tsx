import { NostrEvent, NPool, NRelay1 } from "@nostrify/nostrify";
import { NostrContext } from "@nostrify/react";
import React, { useEffect, useRef } from "react";
import { storeEventTimestamp } from "@/lib/nostrTimestamps";

interface NostrProviderProps {
  children: React.ReactNode;
  relays: string[];
}

/**
 * Custom NPool implementation that tracks timestamps for published events
 */
class TimestampTrackingNPool extends NPool {
  async event(
    event: NostrEvent,
    opts?: { signal?: AbortSignal; relays?: string[] }
  ): Promise<void> {
    // Call the original event method
    await super.event(event, opts);

    // Store the timestamp after successful publishing
    storeEventTimestamp(event.pubkey, event.kind);
  }
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children, relays } = props;

  // Keep relays in a ref so routers use the latest without recreating pool
  const relaysRef = useRef<string[]>(relays);
  useEffect(() => {
    relaysRef.current = relays;
  }, [relays]);

  // NPool instance created once
  const pool = useRef<NPool | undefined>(undefined);
  if (!pool.current) {
    pool.current = new TimestampTrackingNPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters) {
        return new Map(relaysRef.current.map((url) => [url, filters]));
      },
      eventRouter(_event: NostrEvent) {
        return relaysRef.current;
      },
    });
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;
