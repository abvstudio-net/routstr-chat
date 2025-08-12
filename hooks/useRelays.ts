"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadRelays, saveRelays } from '@/utils/storageUtils';

export interface UseRelaysResult {
  relays: string[];
  addRelay: (url: string) => void;
  removeRelay: (url: string) => void;
  setRelays: (urls: string[]) => void;
}

export function useRelays(initialDefaults?: readonly string[]): UseRelaysResult {
  const [relays, setRelaysState] = useState<string[]>(() => loadRelays());
  const seededRef = useRef(false);

  // Seed once on mount if storage empty and defaults provided
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const stored = loadRelays();
    if ((stored?.length ?? 0) === 0 && initialDefaults && initialDefaults.length > 0) {
      const cleaned = Array.from(new Set(initialDefaults.map((u) => u.trim()).filter(Boolean)));
      setRelaysState(cleaned);
      saveRelays(cleaned);
    } else if (stored && stored.length > 0) {
      setRelaysState(stored);
    }
  }, [initialDefaults]);

  // Persist on change
  useEffect(() => {
    saveRelays(relays);
  }, [relays]);

  const setRelays = useCallback((urls: string[]) => {
    const cleaned = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
    setRelaysState((prev) => {
      if (prev.length === cleaned.length && prev.every((v, i) => v === cleaned[i])) return prev;
      return cleaned;
    });
  }, []);

  const addRelay = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setRelaysState((prev) => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed];
    });
  }, []);

  const removeRelay = useCallback((url: string) => {
    setRelaysState((prev) => prev.filter((r) => r !== url));
  }, []);

  return { relays, addRelay, removeRelay, setRelays };
}

export default useRelays;

