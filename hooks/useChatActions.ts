import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, TransactionHistory } from '@/types/chat';
import { createTextMessage, createMultimodalMessage } from '@/utils/messageUtils';
import { fetchAIResponse } from '@/utils/apiUtils';
import { loadTransactionHistory, saveTransactionHistory, loadUsingNip60, saveUsingNip60 } from '@/utils/storageUtils';
import { calculateBalance } from '@/lib/cashu';
import { getBalanceFromStoredProofs, getPendingCashuTokenAmount } from '@/utils/cashuUtils'; // Removed getPendingCashuTokenAmount import
import { useCashuStore } from '@/stores/cashuStore';
import { useCashuWallet } from '@/hooks/useCashuWallet';
import { useCashuToken } from '@/hooks/useCashuToken';
import { DEFAULT_MINT_URL } from '@/lib/utils';
import React from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useCreateCashuWallet } from '@/hooks/useCreateCashuWallet';

export interface UseChatActionsReturn {
  inputMessage: string;
  isLoading: boolean;
  streamingContent: string;
  thinkingContent: string;
  balance: number;
  currentMintUnit: string;
  mintBalances: Record<string, number>;
  mintUnits: Record<string, string>;
  isBalanceLoading: boolean;
  uploadedImages: string[];
  transactionHistory: TransactionHistory[];
  hotTokenBalance: number;
  usingNip60: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  setInputMessage: (message: string) => void;
  setIsLoading: (loading: boolean) => void;
  setStreamingContent: (content: string) => void;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  setUploadedImages: React.Dispatch<React.SetStateAction<string[]>>;
  setTransactionHistory: React.Dispatch<React.SetStateAction<TransactionHistory[]>>;
  setUsingNip60: (using: boolean) => void;
  sendMessage: (
    messages: Message[],
    setMessages: (messages: Message[]) => void,
    activeConversationId: string | null,
    createNewConversation: (initialMessages?: Message[]) => void,
    selectedModel: any,
    baseUrl: string,
    mintUrl: string,
    isAuthenticated: boolean,
    setIsLoginModalOpen: (open: boolean) => void
  ) => Promise<void>;
  saveInlineEdit: (
    editingMessageIndex: number | null,
    editingContent: string,
    messages: Message[],
    setMessages: (messages: Message[]) => void,
    setEditingMessageIndex: (index: number | null) => void,
    setEditingContent: (content: string) => void,
    selectedModel: any,
    baseUrl: string,
    mintUrl: string
  ) => Promise<void>;
  retryMessage: (
    index: number,
    messages: Message[],
    setMessages: (messages: Message[]) => void,
    selectedModel: any,
    baseUrl: string,
    mintUrl: string
  ) => void;
}

/**
 * Custom hook for handling chat operations and AI interactions
 * Manages message sending logic, AI response streaming,
 * token management for API calls, and error handling and retries
 */
export const useChatActions = (): UseChatActionsReturn => {
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [thinkingContent, setThinkingContent] = useState('');
  const [balance, setBalance] = useState(0);
  const [currentMintUnit, setCurrentMintUnit] = useState('sat');
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [pendingCashuAmountState, setPendingCashuAmountState] = useState(0);
  const [transactionHistory, setTransactionHistoryState] = useState<TransactionHistory[]>([]);
  const [hotTokenBalance, setHotTokenBalance] = useState<number>(0);
  const [usingNip60, setUsingNip60State] = useState(() => loadUsingNip60());

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cashu wallet hooks
  const { wallet, isLoading: isWalletLoading, didRelaysTimeout } = useCashuWallet();
  const cashuStore = useCashuStore();
  const { sendToken, receiveToken, cleanSpentProofs } = useCashuToken();
  const { logins } = useAuth();
  const { mutate: handleCreateWallet, isPending: isCreatingWallet, error: createWalletError } = useCreateCashuWallet();

  // Load transaction history on mount
  useEffect(() => {
    const history = loadTransactionHistory();
    setTransactionHistoryState(history);
  }, []);

  // Calculate mint balances
  const { balances: mintBalances, units: mintUnits } = React.useMemo(() => {
    if (!cashuStore.proofs) return { balances: {}, units: {} };
    return calculateBalance(cashuStore.proofs);
  }, [cashuStore.proofs, cashuStore.mints]);

  useEffect(() => {
    setCurrentMintUnit(mintUnits[cashuStore.activeMintUrl??'']);
  }, [mintUnits, cashuStore.activeMintUrl]);

  // Update balance based on wallet type
  useEffect(() => {
    const fetchAndSetBalances = async () => {
      if (usingNip60) {
        if (isWalletLoading) {
          setIsBalanceLoading(true);
          setBalance(0);
        } else {
          setIsBalanceLoading(false);
          let totalBalance = 0;
          for (const mintUrl in mintBalances) {
            const balance = mintBalances[mintUrl];
            const unit = mintUnits[mintUrl];
            if (unit === 'msat') {
              totalBalance += (balance / 1000);
            } else {
              totalBalance += balance;
            }
          }
          setBalance(Math.round((totalBalance + pendingCashuAmountState)*100)/100);
        }
      } else {
        // Legacy wallet balance calculation would go here
        setIsBalanceLoading(false);
        setBalance(getBalanceFromStoredProofs() + pendingCashuAmountState);
      }
    };
    fetchAndSetBalances();
  }, [mintBalances, mintUnits, usingNip60, isWalletLoading, pendingCashuAmountState]);

  // Effect to listen for changes in localStorage for 'current_cashu_token'
  useEffect(() => {
    const updatePendingAmount = () => {
      console.log('rdlogs: pendigl', getPendingCashuTokenAmount())
      setPendingCashuAmountState(getPendingCashuTokenAmount());
    };

    // Initial update
    updatePendingAmount();

    // Listen for storage events
    window.addEventListener('storage', updatePendingAmount);

    // Cleanup
    return () => {
      window.removeEventListener('storage', updatePendingAmount);
    };
  }, [pendingCashuAmountState]);

  // Set active mint URL based on wallet and current mint URL
  useEffect(() => {
    if (logins.length > 0) {
      if (wallet) {
        const currentActiveMintUrl = cashuStore.getActiveMintUrl();
        
        // Only set active mint URL if it's not already set or if current one is not in wallet mints
        if (!currentActiveMintUrl || !wallet.mints?.includes(currentActiveMintUrl)) {
          if (wallet.mints?.includes(DEFAULT_MINT_URL)) {
            cashuStore.setActiveMintUrl(DEFAULT_MINT_URL);
          } else if (wallet.mints && wallet.mints.length > 0) {
            cashuStore.setActiveMintUrl(wallet.mints[0]);
          }
        }
      }

      if (!isWalletLoading) {
        
        if (didRelaysTimeout) {
          console.log('rdlogs: Skipping wallet creation due to relay timeout');
          return;
        }
        
        if (wallet) {
          console.log('rdlogs: Wallet found: ', wallet);
          // Call cleanSpentProofs for each mint in the wallet
          wallet.mints?.forEach(mint => {
            cleanSpentProofs(mint);
          });
        } else {
          console.log('rdlogs: No wallet found, creating new wallet');
          handleCreateWallet();
        }
      } else {
        console.log('rdlogs: Wallet still loading, skipping actions');
      }
    }
  }, [wallet, isWalletLoading, logins, handleCreateWallet, didRelaysTimeout]);

  // Autoscroll moved to ChatMessages to honor user scroll position

  const setTransactionHistory = useCallback((value: React.SetStateAction<TransactionHistory[]>) => {
    setTransactionHistoryState(prev => {
      const newHistory = typeof value === 'function' ? value(prev) : value;
      saveTransactionHistory(newHistory);
      return newHistory;
    });
  }, []);

  const setUsingNip60 = useCallback((using: boolean) => {
    setUsingNip60State(using);
    saveUsingNip60(using);
  }, []);

  const sendMessage = useCallback(async (
    messages: Message[],
    setMessages: (messages: Message[]) => void,
    activeConversationId: string | null,
    createNewConversation: (initialMessages?: Message[]) => void,
    selectedModel: any,
    baseUrl: string,
    mintUrl: string,
    isAuthenticated: boolean,
    setIsLoginModalOpen: (open: boolean) => void
  ) => {
    if (!isAuthenticated) {
      setIsLoginModalOpen(true);
      return;
    }

    if (!inputMessage.trim() && uploadedImages.length === 0) return;

    // Create user message with text and images
    const userMessage = uploadedImages.length > 0
      ? createMultimodalMessage('user', inputMessage, uploadedImages)
      : createTextMessage('user', inputMessage);

    const updatedMessages = [...messages, userMessage];
    
    // Create new conversation if needed with the updated messages
    // This ensures the conversation starts with the user message
    if (!activeConversationId) {
      createNewConversation(updatedMessages);
    } else {
      // Update messages to show the user message right away for existing conversations
      setMessages(updatedMessages);
    }

    setInputMessage('');
    setUploadedImages([]);

    await performAIRequest(updatedMessages, setMessages, selectedModel, baseUrl, mintUrl);
  }, [inputMessage, uploadedImages]);

  const saveInlineEdit = useCallback(async (
    editingMessageIndex: number | null,
    editingContent: string,
    messages: Message[],
    setMessages: (messages: Message[]) => void,
    setEditingMessageIndex: (index: number | null) => void,
    setEditingContent: (content: string) => void,
    selectedModel: any,
    baseUrl: string,
    mintUrl: string
  ) => {
    if (editingMessageIndex !== null && editingContent.trim()) {
      const updatedMessages = [...messages];
      updatedMessages[editingMessageIndex] = {
        ...updatedMessages[editingMessageIndex],
        content: editingContent
      };

      const truncatedMessages = updatedMessages.slice(0, editingMessageIndex + 1);

      setMessages(truncatedMessages);
      setEditingMessageIndex(null);
      setEditingContent('');

      await performAIRequest(truncatedMessages, setMessages, selectedModel, baseUrl, mintUrl);
    }
  }, []);

  const retryMessage = useCallback((
    index: number,
    messages: Message[],
    setMessages: (messages: Message[]) => void,
    selectedModel: any,
    baseUrl: string,
    mintUrl: string
  ) => {
    const newMessages = messages.slice(0, index);
    setMessages(newMessages);
    performAIRequest(newMessages, setMessages, selectedModel, baseUrl, mintUrl);
  }, []);

  const performAIRequest = useCallback(async (
    messageHistory: Message[],
    setMessages: (messages: Message[]) => void,
    selectedModel: any,
    baseUrl: string,
    mintUrl: string
  ) => {
    setIsLoading(true);
    setStreamingContent('');
    setThinkingContent('');

    // Create a ref to track current messages during the API call
    let currentMessages = messageHistory;
    const updateMessages = (newMessages: Message[]) => {
      currentMessages = newMessages;
      setMessages(newMessages);
    };

    try {
      await fetchAIResponse({
        messageHistory,
        selectedModel,
        baseUrl,
        mintUrl,
        usingNip60,
        balance,
        unit: mintUnits[cashuStore.activeMintUrl??mintUrl],
        sendToken: usingNip60 ? sendToken : undefined,
        receiveToken,
        activeMintUrl: cashuStore.activeMintUrl,
        onStreamingUpdate: setStreamingContent,
        onThinkingUpdate: setThinkingContent,
        onMessagesUpdate: updateMessages,
        onMessageAppend: (message) => {
          // Append to current messages state
          const updatedMessages = [...currentMessages, message];
          updateMessages(updatedMessages);
        },
        onBalanceUpdate: setBalance,
        onTransactionUpdate: (transaction) => {
          const updated = [...transactionHistory, transaction];
          setTransactionHistoryState(updated);
          saveTransactionHistory(updated);
          return updated;
        },
        transactionHistory,
        onTokenCreated: setPendingCashuAmountState,
      });
      setPendingCashuAmountState(getPendingCashuTokenAmount());
 
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setThinkingContent('');
    }
  }, [usingNip60, balance, sendToken, receiveToken, cashuStore.activeMintUrl, transactionHistory, setPendingCashuAmountState]);

  return {
    inputMessage,
    isLoading,
    streamingContent,
    thinkingContent,
    balance,
    currentMintUnit,
    mintBalances,
    mintUnits,
    isBalanceLoading,
    uploadedImages,
    transactionHistory,
    hotTokenBalance,
    usingNip60,
    messagesEndRef,
    setInputMessage,
    setIsLoading,
    setStreamingContent,
    setBalance: setBalance,
    setUploadedImages,
    setTransactionHistory,
    setUsingNip60,
    sendMessage,
    saveInlineEdit,
    retryMessage
  };
};