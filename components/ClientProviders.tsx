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
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: Infinity,
    },
  },
});


export default function ClientProviders({ children }: { children: ReactNode }) {
  // Run storage migration on app startup
  useEffect(() => {
    migrateStorageItems();
  }, []);

  // Load user-configured relays (no hardcoded defaults)
  const { relays } = useRelays();

  return (
    <DynamicNostrLoginProvider storageKey='nostr:login'>
      <NostrProvider relays={relays}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </NostrProvider>
    </DynamicNostrLoginProvider>
  );
}