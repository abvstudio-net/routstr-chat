import { useState, useEffect } from 'react';
import { useCashuStore } from '@/stores/cashuStore';
import { useCashuWallet } from '@/hooks/useCashuWallet';
import { useCashuHistory } from '@/hooks/useCashuHistory';
import { CashuMint, CashuWallet, Proof, getDecodedToken, CheckStateEnum } from '@cashu/cashu-ts';
import { CashuProof, CashuToken } from '@/lib/cashu';
import { hashToCurve } from "@cashu/crypto/modules/common";
import { useNutzapStore } from '@/stores/nutzapStore';

export function useCashuToken() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cashuStore = useCashuStore();
  const { wallet, createWallet, updateProofs, tokens } = useCashuWallet();

  const { createHistory } = useCashuHistory();
  const nutzapStore = useNutzapStore();

  /**
   * Recover any pending proofs that were interrupted during token creation
   * This should be called on app startup
   */
  const recoverPendingProofs = async () => {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('pending_send_proofs_'));
      
      for (const key of keys) {
        try {
          const pendingData = JSON.parse(localStorage.getItem(key) || '{}');
          const { mintUrl, proofsToSend, timestamp } = pendingData;
          
          // Only recover proofs that are less than 1 hour old to avoid stale data
          if (Date.now() - timestamp < 60 * 60 * 1000 && mintUrl && proofsToSend) {
            console.log('rdlogs: Recovering pending proofs:', key);
            
            // Add the proofs back to the wallet
            await updateProofs({
              mintUrl,
              proofsToAdd: proofsToSend,
              proofsToRemove: []
            });
          }
          
          // Clean up the pending entry regardless
          localStorage.removeItem(key);
        } catch (error) {
          console.error('Error recovering pending proofs for key:', key, error);
          // Clean up corrupted entries
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Error during pending proofs recovery:', error);
    }
  };

  // Recover pending proofs on hook initialization
  useEffect(() => {
    recoverPendingProofs();
  }, []);

  /**
   * Generate a send token
   * @param mintUrl The URL of the mint to use
   * @param amount Amount to send in satoshis
   * @param p2pkPubkey The P2PK pubkey to lock the proofs to
   * @returns Object containing proofs and preferred unit
   */
  const sendToken = async (mintUrl: string, amount: number, p2pkPubkey?: string): Promise<{ proofs: Proof[], unit: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const mint = new CashuMint(mintUrl);
      const keysets = await mint.getKeySets();
      
      // Get preferred unit: msat over sat if both are active
      const activeKeysets = keysets.keysets.filter(k => k.active);
      const units = [...new Set(activeKeysets.map(k => k.unit))];
      const preferredUnit = units.includes('msat') ? 'msat' : (units.includes('sat') ? 'sat' : 'not supported');
      
      const wallet = new CashuWallet(mint, { unit: preferredUnit });

      // Load mint keysets
      await wallet.loadMint();

      // Get all proofs from store
      let proofs = await cashuStore.getMintProofs(mintUrl);
      
      // Calculate fees using the Python reference implementation
      const calculateFees = (inputProofs: Proof[]): number => {
        let sumFees = 0;
        for (const proof of inputProofs) {
          const keyset = activeKeysets.find(k => k.id === proof.id);
          if (keyset && keyset.input_fee_ppk !== undefined) {
            sumFees += keyset.input_fee_ppk;
          }
        }
        return Math.floor((sumFees + 999) / 1000);
      };
      
      const fees = calculateFees(proofs);
      console.log("rdlogs: fees", fees, "for proofs:", proofs.length);

      const proofsAmount = proofs.reduce((sum, p) => sum + p.amount, 0);
      const denominationCounts = proofs.reduce((acc, p) => {
        acc[p.amount] = (acc[p.amount] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      console.log('rdlogs: Proof denomination groups:', denominationCounts);
      if (proofsAmount < amount) {
        throw new Error(`Not enough funds on mint ${mintUrl}`);
      }

      /**
       * Check if we can make exact change using available denominations
       * Uses a greedy approach with backtracking for optimal denomination selection
       */
      const canMakeExactChange = (targetAmount: number, denomCounts: Record<number, number>, availableProofs: Proof[]): { canMake: boolean, selectedProofs?: Proof[] } => {
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
      };

      // Check if we can make exact change
      const exactChangeResult = canMakeExactChange(amount, denominationCounts, proofs);
      console.log('rdlogs: Exact change check for amount', amount, ':', exactChangeResult.canMake);
      
      if (exactChangeResult.canMake && exactChangeResult.selectedProofs) {
        const selectedDenominations = exactChangeResult.selectedProofs.map(p => p.amount).sort((a, b) => b - a);
        const denominationCounts = selectedDenominations.reduce((acc, denom) => {
          acc[denom] = (acc[denom] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        
        console.log('rdlogs: Can make exact change, using selected proofs directly');
        console.log('rdlogs: Selected denominations:', selectedDenominations);
        console.log('rdlogs: Denomination breakdown:', denominationCounts);
        
        // Use the selected proofs directly without calling wallet.send
        const proofsToSend = exactChangeResult.selectedProofs;
        const proofsToKeep = proofs.filter(p => !proofsToSend.includes(p));

        // Store proofs temporarily before updating wallet state
        const pendingProofsKey = `pending_send_proofs_${Date.now()}`;
        localStorage.setItem(pendingProofsKey, JSON.stringify({
          mintUrl,
          proofsToSend: proofsToSend.map(p => ({
            id: p.id || '',
            amount: p.amount,
            secret: p.secret || '',
            C: p.C || ''
          })),
          timestamp: Date.now()
        }));

        const sendFees = calculateFees(proofsToSend);
        console.log('rdlogs: fees to send ', amount, ' is ', sendFees);

        // Create new token for the proofs we're keeping
        if (proofsToKeep.length > 0) {
          const keepTokenData: CashuToken = {
            mint: mintUrl,
            proofs: proofsToKeep.map(p => ({
              id: p.id || '',
              amount: p.amount,
              secret: p.secret || '',
              C: p.C || ''
            }))
          };

          // update proofs
          await updateProofs({ mintUrl, proofsToAdd: keepTokenData.proofs, proofsToRemove: [...proofsToSend, ...proofs] });

          // Create history event
          await createHistory({
            direction: 'out',
            amount: amount.toString(),
          });
        }
        
        // Store the pending proofs key with the returned proofs for cleanup
        (proofsToSend as any).pendingProofsKey = pendingProofsKey;
        
        return { proofs: proofsToSend, unit: preferredUnit };
      }

      console.log('rdlogs: Cannot make exact change, using wallet.send()');

      try {

        
        const { keep: proofsToKeep, send: proofsToSend } = await wallet.send(amount, proofs, { pubkey: p2pkPubkey, privkey: cashuStore.privkey});

        // Store proofs temporarily before updating wallet state
        const pendingProofsKey = `pending_send_proofs_${Date.now()}`;
        localStorage.setItem(pendingProofsKey, JSON.stringify({
          mintUrl,
          proofsToSend: proofsToSend.map(p => ({
            id: p.id || '',
            amount: p.amount,
            secret: p.secret || '',
            C: p.C || ''
          })),
          timestamp: Date.now()
        }));
        const sendFees = calculateFees(proofsToSend);
        console.log('rdlogs: fees to send ', amount, ' is ', sendFees)

        // Create new token for the proofs we're keeping
        if (proofsToKeep.length > 0) {
          const keepTokenData: CashuToken = {
            mint: mintUrl,
            proofs: proofsToKeep.map(p => ({
              id: p.id || '',
              amount: p.amount,
              secret: p.secret || '',
              C: p.C || ''
            }))
          };

          // update proofs
          await updateProofs({ mintUrl, proofsToAdd: keepTokenData.proofs, proofsToRemove: [...proofsToSend, ...proofs] });

          // Create history event
          await createHistory({
            direction: 'out',
            amount: amount.toString(),
          });
        }
        
        // Store the pending proofs key with the returned proofs for cleanup
        (proofsToSend as any).pendingProofsKey = pendingProofsKey;
        
        return { proofs: proofsToSend, unit: preferredUnit };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        
        // Check if error is "Token already spent"
        if (message.includes("Token already spent")) {
          console.log("Detected spent tokens, cleaning up and retrying...");
          
          // Clean spent proofs
          await cleanSpentProofs(mintUrl);
          
          // Get fresh proofs after cleanup
          proofs = await cashuStore.getMintProofs(mintUrl);
          
          // Check if we still have enough funds after cleanup
          const newProofsAmount = proofs.reduce((sum, p) => sum + p.amount, 0);
          if (newProofsAmount < amount) {
            throw new Error(`Not enough funds on mint ${mintUrl} after cleaning spent proofs`);
          }
          
          // Check exact change again with fresh proofs
          const freshDenominationCounts = proofs.reduce((acc, p) => {
            acc[p.amount] = (acc[p.amount] || 0) + 1;
            return acc;
          }, {} as Record<number, number>);
          
          const exactChangeRetryResult = canMakeExactChange(amount, freshDenominationCounts, proofs);
          
          let proofsToKeep: Proof[], proofsToSend: Proof[];
          
          if (exactChangeRetryResult.canMake && exactChangeRetryResult.selectedProofs) {
            const selectedDenominations = exactChangeRetryResult.selectedProofs.map(p => p.amount).sort((a, b) => b - a);
            const denominationCounts = selectedDenominations.reduce((acc, denom) => {
              acc[denom] = (acc[denom] || 0) + 1;
              return acc;
            }, {} as Record<number, number>);
            
            console.log('rdlogs: Can make exact change on retry, using selected proofs directly');
            console.log('rdlogs: Selected denominations on retry:', selectedDenominations);
            console.log('rdlogs: Denomination breakdown on retry:', denominationCounts);
            
            proofsToSend = exactChangeRetryResult.selectedProofs;
            proofsToKeep = proofs.filter(p => !proofsToSend.includes(p));
          } else {
            console.log('rdlogs: Cannot make exact change on retry, using wallet.send()');
            const result = await wallet.send(amount, proofs, { pubkey: p2pkPubkey, privkey: cashuStore.privkey });
            proofsToKeep = result.keep;
            proofsToSend = result.send;
          }

          // Store proofs temporarily before updating wallet state (retry case)
          const pendingProofsKey = `pending_send_proofs_${Date.now()}`;
          localStorage.setItem(pendingProofsKey, JSON.stringify({
            mintUrl,
            proofsToSend: proofsToSend.map(p => ({
              id: p.id || '',
              amount: p.amount,
              secret: p.secret || '',
              C: p.C || ''
            })),
            timestamp: Date.now()
          }));

          // Create new token for the proofs we're keeping
          if (proofsToKeep.length > 0) {
            const keepTokenData: CashuToken = {
              mint: mintUrl,
              proofs: proofsToKeep.map(p => ({
                id: p.id || '',
                amount: p.amount,
                secret: p.secret || '',
                C: p.C || ''
              }))
            };

            // update proofs
            await updateProofs({ mintUrl, proofsToAdd: keepTokenData.proofs, proofsToRemove: [...proofsToSend, ...proofs] });

            // Create history event
            await createHistory({
              direction: 'out',
              amount: amount.toString(),
            });
          }
          
          // Store the pending proofs key with the returned proofs for cleanup
          (proofsToSend as any).pendingProofsKey = pendingProofsKey;
          
          return { proofs: proofsToSend, unit: preferredUnit };
        }
        else if(message.includes("Not enough funds available")) {
          setError(`Failed to generate token: ${message}`);
          throw error;
        }
        else {
          // Re-throw the error if it's not a "Token already spent" error
          throw error;
        }
        
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(`Failed to generate token: ${message}`);
      console.log('rdlogs: amount adn error', amount, message)
      throw error;
    } finally {
      setIsLoading(false);
    }

  };

  const addMintIfNotExists = async (mintUrl: string) => {
    // Validate URL
    new URL(mintUrl);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    // Add mint to wallet
    createWallet({
      ...wallet,
      mints: [...wallet.mints, mintUrl],
    });
  }

  /**
   * Receive a token
   * @param token The encoded token string
   * @returns The received proofs
   */
  const receiveToken = async (token: string): Promise<Proof[]> => {
    setIsLoading(true);
    setError(null);

    try {
      // Decode token
      const decodedToken = getDecodedToken(token);
      if (!decodedToken) {
        throw new Error('Invalid token format');
      }

      const { mint: mintUrl, proofs: tokenProofs, unit: unit } = decodedToken;
      console.log("rdlogs profs: ", tokenProofs, unit)

      // if we don't have the mintUrl yet, add it
      await addMintIfNotExists(mintUrl);

      // Setup wallet for receiving
      const mint = new CashuMint(mintUrl);
      const keysets = await mint.getKeySets();
      
      // Get preferred unit: msat over sat if both are active
      const activeKeysets = keysets.keysets.filter(k => k.active);
      const units = [...new Set(activeKeysets.map(k => k.unit))];
      const preferredUnit = units.includes('msat') ? 'msat' : (units.includes('sat') ? 'sat' : 'not supported');
      
      const wallet = new CashuWallet(mint, { unit: preferredUnit });

      // Load mint keysets
      await wallet.loadMint();
      console.log(wallet.keysets)

      // Receive proofs from token
      const receivedProofs = await wallet.receive(token);
      // Create token event in Nostr
      const receivedTokenData: CashuToken = {
        mint: mintUrl,
        proofs: receivedProofs.map(p => ({
          id: p.id || '',
          amount: p.amount,
          secret: p.secret || '',
          C: p.C || ''
        }))
      };

      try {
        // Attempt to create token in Nostr, but don't rely on the return value
        await updateProofs({ mintUrl, proofsToAdd: receivedTokenData.proofs, proofsToRemove: [] });
      } catch (err) {
        console.error('Error storing token in Nostr:', err);
      }

      // Create history event
      const totalAmount = receivedProofs.reduce((sum, p) => sum + p.amount, 0);
      await createHistory({
        direction: 'in',
        amount: totalAmount.toString(),
      });

      return receivedProofs;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(`Failed to receive token: ${message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const cleanSpentProofs = async (mintUrl: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const mint = new CashuMint(mintUrl);
      
      // Get preferred unit: msat over sat if both are active
      const keysets = await mint.getKeySets();
      const activeKeysets = keysets.keysets.filter(k => k.active);
      const units = [...new Set(activeKeysets.map(k => k.unit))];
      const preferredUnit = units.includes('msat') ? 'msat' : (units.includes('sat') ? 'sat' : units[0]);
      
      const wallet = new CashuWallet(mint, { unit: preferredUnit });

      await wallet.loadMint();

      const proofs = await cashuStore.getMintProofs(mintUrl);

      const proofStates = await wallet.checkProofsStates(proofs);
      const spentProofsStates = proofStates.filter(
        (p) => p.state == CheckStateEnum.SPENT
      );
      const enc = new TextEncoder();
      const spentProofs = proofs.filter((p) =>
        spentProofsStates.find(
          (s) => s.Y == hashToCurve(enc.encode(p.secret)).toHex(true)
        )
      );

      await updateProofs({ mintUrl, proofsToAdd: [], proofsToRemove: spentProofs });

      return spentProofs;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(`Failed to clean spent proofs: ${message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Clean up pending proofs after successful token creation
   * @param pendingProofsKey The key used to store pending proofs
   */
  const cleanupPendingProofs = (pendingProofsKey: string) => {
    try {
      localStorage.removeItem(pendingProofsKey);
    } catch (error) {
      console.error('Error cleaning up pending proofs:', error);
    }
  };

  return {
    sendToken,
    receiveToken,
    cleanSpentProofs,
    cleanupPendingProofs,
    addMintIfNotExists,
    isLoading,
    error
  };
} 