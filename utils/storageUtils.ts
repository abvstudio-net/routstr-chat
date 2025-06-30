import { TransactionHistory } from '@/types/chat';

/**
 * Generic localStorage helper with error handling
 * @param key Storage key
 * @param value Value to store (will be JSON stringified)
 */
export const setStorageItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error storing item with key "${key}":`, error);
  }
};

/**
 * Generic localStorage getter with error handling and type safety
 * @param key Storage key
 * @param defaultValue Default value to return if key not found or parsing fails
 * @returns Parsed value or default value
 */
export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item);
  } catch (error) {
    console.error(`Error retrieving item with key "${key}":`, error);
    return defaultValue;
  }
};

/**
 * Remove an item from localStorage
 * @param key Storage key to remove
 */
export const removeStorageItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing item with key "${key}":`, error);
  }
};

/**
 * Check if a key exists in localStorage
 * @param key Storage key to check
 * @returns True if key exists, false otherwise
 */
export const hasStorageItem = (key: string): boolean => {
  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error(`Error checking existence of key "${key}":`, error);
    return false;
  }
};

/**
 * Clear all localStorage items (use with caution)
 */
export const clearAllStorage = (): void => {
  try {
    localStorage.clear();
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
};

// Specific storage utilities for the chat app

/**
 * Load transaction history from localStorage
 * @returns Array of transaction history or empty array
 */
export const loadTransactionHistory = (): TransactionHistory[] => {
  return getStorageItem<TransactionHistory[]>('transaction_history', []);
};

/**
 * Save transaction history to localStorage
 * @param history Array of transaction history
 */
export const saveTransactionHistory = (history: TransactionHistory[]): void => {
  setStorageItem('transaction_history', history);
};

/**
 * Load favorite models from localStorage
 * @returns Array of favorite model IDs
 */
export const loadFavoriteModels = (): string[] => {
  return getStorageItem<string[]>('favorite_models', []);
};

/**
 * Save favorite models to localStorage
 * @param favoriteModels Array of favorite model IDs
 */
export const saveFavoriteModels = (favoriteModels: string[]): void => {
  setStorageItem('favorite_models', favoriteModels);
};

/**
 * Load last used model ID from localStorage
 * @returns Last used model ID or null
 */
export const loadLastUsedModel = (): string | null => {
  return getStorageItem<string | null>('lastUsedModel', null);
};

/**
 * Save last used model ID to localStorage
 * @param modelId Model ID to save
 */
export const saveLastUsedModel = (modelId: string): void => {
  setStorageItem('lastUsedModel', modelId);
};

/**
 * Load mint URL from localStorage
 * @param defaultMintUrl Default mint URL to use if none stored
 * @returns Stored or default mint URL
 */
export const loadMintUrl = (defaultMintUrl: string): string => {
  return getStorageItem<string>('mint_url', defaultMintUrl);
};

/**
 * Save mint URL to localStorage
 * @param mintUrl Mint URL to save
 */
export const saveMintUrl = (mintUrl: string): void => {
  setStorageItem('mint_url', mintUrl);
};

/**
 * Load base URL from localStorage
 * @param defaultBaseUrl Default base URL to use if none stored
 * @returns Stored or default base URL (normalized with trailing slash)
 */
export const loadBaseUrl = (defaultBaseUrl: string): string => {
  const baseUrl = getStorageItem<string>('base_url', defaultBaseUrl);
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

/**
 * Save base URL to localStorage
 * @param baseUrl Base URL to save
 */
export const saveBaseUrl = (baseUrl: string): void => {
  setStorageItem('base_url', baseUrl);
};

/**
 * Load NIP-60 usage preference from localStorage
 * @returns True if using NIP-60, defaults to true if not set
 */
export const loadUsingNip60 = (): boolean => {
  const storedValue = localStorage.getItem('usingNip60');
  return storedValue === null ? true : storedValue === 'true';
};

/**
 * Save NIP-60 usage preference to localStorage
 * @param usingNip60 Whether to use NIP-60
 */
export const saveUsingNip60 = (usingNip60: boolean): void => {
  setStorageItem('usingNip60', usingNip60.toString());
};

/**
 * Check if user has seen the tutorial
 * @returns True if tutorial has been seen
 */
export const hasSeenTutorial = (): boolean => {
  return hasStorageItem('hasSeenTutorial');
};

/**
 * Mark tutorial as seen
 */
export const markTutorialAsSeen = (): void => {
  setStorageItem('hasSeenTutorial', 'true');
};

/**
 * Storage keys used throughout the application
 */
export const STORAGE_KEYS = {
  CONVERSATIONS: 'saved_conversations',
  TRANSACTION_HISTORY: 'transaction_history',
  FAVORITE_MODELS: 'favorite_models',
  LAST_USED_MODEL: 'lastUsedModel',
  MINT_URL: 'mint_url',
  BASE_URL: 'base_url',
  USING_NIP60: 'usingNip60',
  TUTORIAL_SEEN: 'hasSeenTutorial',
  CURRENT_CASHU_TOKEN: 'current_cashu_token',
  CASHU_PROOFS: 'cashu_proofs',
  WRAPPED_CASHU_TOKENS: 'wrapped_cashu_tokens'
} as const;