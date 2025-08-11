// Types and utilities for Cashu wallet (NIP-60)

import { useCashuStore } from "@/stores/cashuStore";
import { CashuMint, Proof, CashuWallet, GetInfoResponse, MintKeyset, MintKeys, getDecodedToken } from "@cashu/cashu-ts";

export interface CashuProof {
  id: string;
  amount: number;
  secret: string;
  C: string;
}

export interface CashuToken {
  mint: string;
  proofs: CashuProof[];
  del?: string[]; // token-ids that were destroyed by the creation of this token
}

export interface CashuWalletStruct {
  privkey: string; // Private key used to unlock P2PK ecash
  mints: string[]; // List of mint URLs
}

export interface SpendingHistoryEntry {
  direction: 'in' | 'out';
  amount: string;
  createdTokens?: string[];
  destroyedTokens?: string[];
  redeemedTokens?: string[];
  timestamp?: number;
}

// Event kinds as defined in NIP-60
export const CASHU_EVENT_KINDS = {
  WALLET: 17375, // Replaceable event for wallet info
  TOKEN: 7375,   // Token events for unspent proofs
  HISTORY: 7376, // Spending history events
  QUOTE: 7374,   // Quote events (optional)
  ZAPINFO: 10019, // ZAP info events
  ZAP: 9321,     // ZAP events
};

export const defaultMints = [
  "https://mint.minibits.cash/Bitcoin",
];

// Helper function to calculate total balance from tokens
export function calculateBalance(proofs: Proof[]): { balances: Record<string, number>, units: Record<string, string> } {
  const balances: { [mint: string]: number } = {};
  const units: { [mint: string]: string } = {};
  const mints = useCashuStore.getState().mints;
  for (const mint of mints) {
    balances[mint.url] = 0;
    units[mint.url] = 'sat';
    const keysets = mint.keysets;
    if (!keysets) continue;
    for (const keyset of keysets) {
      // select all proofs with id == keyset.id
      const proofsForKeyset = proofs.filter((proof) => proof.id === keyset.id);
      if (proofsForKeyset.length) {
        balances[mint.url] += proofsForKeyset.reduce((acc, proof) => acc + proof.amount, 0);
        units[mint.url] = keyset.unit
      }
    }
  }
  return { balances, units };
}

// Helper function to add thousands separator to a number
function addThousandsSeparator(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Helper function to format balance with appropriate units
export function formatBalance(balance: number, unit: string): string {
  if (balance >= 1000000) {
    return `${(balance / 1000000).toFixed(1)}M ${unit}`;
  } else if (balance >= 100000) {
    return `${(balance / 1000).toFixed(1)}k ${unit}`;
  } else {
    return `${addThousandsSeparator(balance)} ${unit}`;
  }
}

export async function activateMint(mintUrl: string): Promise<{ mintInfo: GetInfoResponse, keysets: MintKeyset[] }> {
  const mint = new CashuMint(mintUrl);
  const wallet = new CashuWallet(mint);
  const msatWallet = new CashuWallet(mint, {'unit': 'msat'});
  const mintInfo = await wallet.getMintInfo();
  const walletKeysets = await wallet.getKeySets();
  const msatKeysets = await msatWallet.getKeySets();
  const allKeysets = Array.from(new Set([...walletKeysets, ...msatKeysets]));
  return { mintInfo, keysets: allKeysets };
}

export async function updateMintKeys(mintUrl: string, keysets: MintKeyset[]): Promise<{ keys: Record<string, MintKeys>[] }> {
  const mint = new CashuMint(mintUrl);
  const wallet = new CashuWallet(mint);
  const msatWallet = new CashuWallet(mint, {'unit': 'msat'});
  const walletKeysets = await wallet.getKeySets();
  const msatKeysets = await msatWallet.getKeySets();

  // const wallet = new CashuWallet(mint, { unit: preferredUnit });

  // get keysets from store
  const keysetsLocal = useCashuStore.getState().mints.find((m) => m.url === mintUrl)?.keysets;
  let keysLocal = useCashuStore.getState().mints.find((m) => m.url === mintUrl)?.keys;

  if (!keysetsLocal || !keysLocal || keysetsLocal !== keysets) {
    if (!keysLocal) {
      keysLocal = []
    }
    // get all keys for each keyset where keysetLocal != keyset and add them to the keysLocal
    const keys = await Promise.all(keysets.map(async (keyset) => {
      // Use the appropriate wallet based on which keyset list contains this keyset.id
      const isInWalletKeysets = walletKeysets.some(k => k.id === keyset.id);
      const walletToUse = isInWalletKeysets ? wallet : msatWallet;
      return { [keyset.id]: await walletToUse.getKeys(keyset.id) };
    }));
    keysLocal = keysLocal.concat(keys);
    return { keys: keysLocal };
  } else {
    return { keys: keysLocal };
  }
}

export function getTokenAmount(token: string): number {
  const tokenObj = getDecodedToken(token);
  return tokenObj.proofs.reduce((acc, proof) => acc + proof.amount, 0);
}

/**
 * Check if we can make exact change using available denominations
 * Uses a greedy approach with backtracking for optimal denomination selection
 * @param targetAmount The amount we need to make
 * @param denomCounts A map of denomination values to their counts
 * @param availableProofs The actual proof objects available
 * @returns Object indicating if exact change can be made and the selected proofs if possible
 */
export function canMakeExactChange(
  targetAmount: number,
  denomCounts: Record<number, number>,
  availableProofs: Proof[],
  fees?: number
): { canMake: boolean, selectedProofs?: Proof[] } {
  // If fees are defined, we need to account for them
  if (fees !== undefined && fees > 0) {
    // We need to iteratively calculate the total amount needed including fees
    // Start with the target amount and keep adding fees until we converge
    let totalNeeded = targetAmount;
    let previousProofCount = 0;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops
    
    // Keep track of denomination usage for fee calculation
    const usedDenoms: Record<number, number> = {};
    
    while (iterations < maxIterations) {
      iterations++;
      
      // Try to find a combination for the current totalNeeded
      const result = findExactCombination(totalNeeded, denomCounts, availableProofs);
      
      if (!result.canMake) {
        return { canMake: false };
      }
      
      // Count the number of proofs in the solution
      const currentProofCount = result.selectedProofs!.length;
      
      // Calculate the fee for this number of proofs
      const requiredFee = currentProofCount * fees;
      
      // Check if we've converged (total amount covers both target and fees)
      const currentTotal = result.selectedProofs!.reduce((sum, p) => sum + p.amount, 0);
      if (currentTotal >= targetAmount + requiredFee) {
        // Verify we have exactly the right amount
        if (currentTotal === targetAmount + requiredFee) {
          return { canMake: true, selectedProofs: result.selectedProofs };
        }
        // If we have too much, we can't make exact change
        return { canMake: false };
      }
      
      // Update totalNeeded for next iteration
      totalNeeded = targetAmount + requiredFee;
      
      // Check if we're stuck in a loop
      if (currentProofCount === previousProofCount) {
        // We're not making progress, can't satisfy the fee requirement
        return { canMake: false };
      }
      
      previousProofCount = currentProofCount;
    }
    
    // If we hit max iterations, we couldn't find a solution
    return { canMake: false };
  }
  
  // No fees, use the original logic
  return findExactCombination(targetAmount, denomCounts, availableProofs);
}

/**
 * Helper function to find exact combination using dynamic programming
 */
function findExactCombination(
  targetAmount: number,
  denomCounts: Record<number, number>,
  availableProofs: Proof[]
): { canMake: boolean, selectedProofs?: Proof[] } {
  // Use dynamic programming with proper denomination counting
  const denominations = Object.keys(denomCounts).map(Number).sort((a, b) => a - b); // Sort ascending for DP
  
  // Create a map to track which denominations are used to reach each amount
  const dp: Map<number, Record<number, number>> = new Map();
  dp.set(0, {}); // Base case: 0 can be made with no coins
  
  for (let amount = 1; amount <= targetAmount; amount++) {
    for (const denom of denominations) {
      if (amount >= denom) {
        const prevAmount = amount - denom;
        const prevSolution = dp.get(prevAmount);
        
        if (prevSolution !== undefined) {
          const prevDenomCount = prevSolution[denom] || 0;
          
          // Check if we can use another coin of this denomination
          if (prevDenomCount < denomCounts[denom]) {
            const newSolution = { ...prevSolution };
            newSolution[denom] = prevDenomCount + 1;
            
            // Only update if we haven't found a solution for this amount yet
            // or if this solution uses fewer total coins
            const currentSolution = dp.get(amount);
            if (!currentSolution) {
              dp.set(amount, newSolution);
            }
          }
        }
      }
    }
  }
  
  const finalSolution = dp.get(targetAmount);
  if (finalSolution) {
    // We found a solution! Now select the actual proofs
    const selectedProofs: Proof[] = [];
    
    for (const [denomStr, count] of Object.entries(finalSolution)) {
      const denom = Number(denomStr);
      const proofsOfDenom = availableProofs.filter(p => p.amount === denom);
      
      // Make sure we have enough proofs of this denomination
      if (proofsOfDenom.length < count) {
        console.error(`Not enough proofs of denomination ${denom}: need ${count}, have ${proofsOfDenom.length}`);
        return { canMake: false };
      }
      
      selectedProofs.push(...proofsOfDenom.slice(0, count));
    }
    
    // Verify the sum is correct
    const totalSum = selectedProofs.reduce((sum, p) => sum + p.amount, 0);
    if (totalSum !== targetAmount) {
      console.error(`Sum mismatch: expected ${targetAmount}, got ${totalSum}`);
      return { canMake: false };
    }
    
    return { canMake: true, selectedProofs };
  }
  
  return { canMake: false };
}

/**
 * Calculate fees using the Python reference implementation
 * @param inputProofs The proofs to calculate fees for
 * @param activeKeysets The active keysets from the mint
 * @returns The calculated fees in satoshis
 */
export function calculateFees(inputProofs: Proof[], activeKeysets: MintKeyset[]): number {
  let sumFees = 0;
  for (const proof of inputProofs) {
    const keyset = activeKeysets.find(k => k.id === proof.id);
    if (keyset && keyset.input_fee_ppk !== undefined) {
      sumFees += keyset.input_fee_ppk;
    }
  }
  return Math.floor((sumFees + 999) / 1000);
}