'use client';

import { ReactNode, useEffect } from 'react';
// import { NostrProvider } from '@/context/NostrContext';
import NostrProvider from '@/components/NostrProvider'
import dynamic from 'next/dynamic';
import { migrateStorageItems } from '@/utils/storageUtils';
import useRelays from '@/hooks/useRelays';

const DynamicNostrLoginProvider = dynamic(
  () => import('@nostrify/react/login').then((mod) => mod.NostrLoginProvider),
  { ssr: false }
);

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppProvider } from './AppProvider';
import { AppConfig } from '@/context/AppContext';

const presetRelays = [
  { url: 'wss://relay.chorus.community', name: 'Chorus' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: Infinity,
    },
  },
});

const defaultConfig: AppConfig = {
  relayUrls: [
...presetRelays.slice(0, 3).map(relay => relay.url),
  ]
};

export default function ClientProviders({ children }: { children: ReactNode }) {
  // Run storage migration on app startup
  useEffect(() => {
    migrateStorageItems();
  }, []); 

  // Load user-configured relays (no hardcoded defaults)
  const { relays } = useRelays();

  return (
    <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig} presetRelays={presetRelays}>
      <DynamicNostrLoginProvider storageKey='nostr:login'>
        <NostrProvider>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </NostrProvider>
      </DynamicNostrLoginProvider>
    </AppProvider>
  );
}