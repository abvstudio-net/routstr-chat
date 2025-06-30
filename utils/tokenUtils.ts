import { create60CashuToken, getOrCreateApiToken, invalidateApiToken } from '@/utils/cashuUtils';

// Default token amount for models without max_cost defined
export const DEFAULT_TOKEN_AMOUNT = 50;

/**
 * Manages token lifecycle for NIP-60 - reuses existing token or generates new one
 * @param mintUrl The Cashu mint URL
 * @param amount Amount in sats for new token if needed
 * @param sendToken Function to send tokens from the wallet
 * @param activeMintUrl The currently active mint URL
 * @returns Token string, null if failed, or object with hasTokens: false if no tokens available
 */
export const getOrCreate60ApiToken = async (
  mintUrl: string,
  amount: number,
  sendToken: (mintUrl: string, amount: number) => Promise<any[]>,
  activeMintUrl: string | null
): Promise<string | null | { hasTokens: false }> => {
  try {
    // Try to get existing token
    const storedToken = localStorage.getItem("current_cashu_token");
    if (storedToken) {
      return storedToken;
    }

    // Generate new token if none exists
    if (!activeMintUrl) {
      console.error("No active mint selected");
      return null;
    }
    
    const newToken = await create60CashuToken(activeMintUrl, sendToken, amount);
    if (newToken) {
      localStorage.setItem("current_cashu_token", newToken);
      return newToken;
    }

    return null;
  } catch (error) {
    console.error("Error in token management:", error);
    return null;
  }
};

/**
 * Gets the appropriate token based on the wallet type being used
 * @param usingNip60 Whether using NIP-60 wallet or legacy wallet
 * @param mintUrl The Cashu mint URL
 * @param amount Amount in sats for new token if needed
 * @param sendToken Function to send tokens from NIP-60 wallet
 * @param activeMintUrl The currently active mint URL for NIP-60
 * @returns Token string, null if failed, or object with hasTokens: false if no tokens available
 */
export const getTokenForRequest = async (
  usingNip60: boolean,
  mintUrl: string,
  amount: number,
  sendToken?: (mintUrl: string, amount: number) => Promise<any[]>,
  activeMintUrl?: string | null
): Promise<string | null | { hasTokens: false }> => {
  if (usingNip60) {
    if (!sendToken || !activeMintUrl) {
      console.error("Missing required parameters for NIP-60 token creation");
      return null;
    }
    return await getOrCreate60ApiToken(mintUrl, amount, sendToken, activeMintUrl);
  } else {
    return await getOrCreateApiToken(mintUrl, amount);
  }
};

/**
 * Invalidates the current API token stored in localStorage
 */
export const clearCurrentApiToken = (): void => {
  invalidateApiToken();
};

/**
 * Gets the token amount to use for a model, with fallback to default
 * @param selectedModel The currently selected model
 * @returns The token amount in sats
 */
export const getTokenAmountForModel = (selectedModel: any): number => {
  return selectedModel?.sats_pricing?.max_cost ?? DEFAULT_TOKEN_AMOUNT;
};