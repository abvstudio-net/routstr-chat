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
    console.log('rdlogs: mint porofs', proofs)
    console.log('rdlogs: mint keysets', mint.url, keysets)
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
  const keysets = await wallet.getKeySets();
  const msatKeysets = await msatWallet.getKeySets();
  const allKeysets = Array.from(new Set([...keysets, ...msatKeysets]));
  return { mintInfo, keysets: allKeysets };
}

export async function updateMintKeys(mintUrl: string, keysets: MintKeyset[]): Promise<{ keys: Record<string, MintKeys>[] }> {
  const mint = new CashuMint(mintUrl);
  const wallet = new CashuWallet(mint);

  // get keysets from store
  const keysetsLocal = useCashuStore.getState().mints.find((m) => m.url === mintUrl)?.keysets;
  let keysLocal = useCashuStore.getState().mints.find((m) => m.url === mintUrl)?.keys;

  if (!keysetsLocal || !keysLocal || keysetsLocal !== keysets) {
    if (!keysLocal) {
      keysLocal = []
    }
    // get all keys for each keyset where keysetLocal != keyset and add them to the keysLocal
    const keys = await Promise.all(keysets.map(async (keyset) => {
      return { [keyset.id]: await wallet.getKeys(keyset.id) };
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