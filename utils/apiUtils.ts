import { Message, TransactionHistory } from '@/types/chat';
import { convertMessageForAPI, createTextMessage } from './messageUtils';
import { getTokenForRequest, getTokenAmountForModel, clearCurrentApiToken } from './tokenUtils';
import { fetchBalances, getBalanceFromStoredProofs, unifiedRefund } from '@/utils/cashuUtils';

export interface FetchAIResponseParams {
  messageHistory: Message[];
  selectedModel: any;
  baseUrl: string;
  mintUrl: string;
  usingNip60: boolean;
  balance: number;
  sendToken?: (mintUrl: string, amount: number) => Promise<any[]>;
  receiveToken: (token: string) => Promise<any[]>;
  activeMintUrl?: string | null;
  onStreamingUpdate: (content: string) => void;
  onMessagesUpdate: (messages: Message[]) => void;
  onBalanceUpdate: (balance: number) => void;
  onTransactionUpdate: (transaction: TransactionHistory) => void;
  transactionHistory: TransactionHistory[];
}

/**
 * Fetches AI response from the API with streaming support
 * @param params Configuration object with all required parameters
 * @returns Promise that resolves when the response is complete
 */
export const fetchAIResponse = async (params: FetchAIResponseParams): Promise<void> => {
  const {
    messageHistory,
    selectedModel,
    baseUrl,
    mintUrl,
    usingNip60,
    balance,
    sendToken,
    receiveToken,
    activeMintUrl,
    onStreamingUpdate,
    onMessagesUpdate,
    onBalanceUpdate,
    onTransactionUpdate,
    transactionHistory
  } = params;

  const initialBalance = usingNip60 ? balance : getBalanceFromStoredProofs();
  const tokenAmount = getTokenAmountForModel(selectedModel);

  const makeRequest = async (retryOnInsufficientBalance: boolean = true): Promise<Response> => {
    const token = await getTokenForRequest(
      usingNip60,
      mintUrl,
      tokenAmount,
      sendToken,
      activeMintUrl
    );

    if (!token) {
      throw new Error(`Insufficient balance. Please add more funds to continue. You need at least ${Number(tokenAmount).toFixed(0)} sats to use ${selectedModel?.id}`);
    }

    if (typeof token === 'object' && 'hasTokens' in token && !token.hasTokens) {
      throw new Error(`Insufficient balance. Please add more funds to continue. You need at least ${Number(tokenAmount).toFixed(0)} sats to use ${selectedModel?.id}`);
    }

    // Convert messages to API format
    const apiMessages = messageHistory.map(convertMessageForAPI);

    const response = await fetch(`${baseUrl}v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: selectedModel?.id,
        messages: apiMessages,
        stream: true
      })
    });

    if (!response.ok) {
      await handleApiError(response, {
        mintUrl,
        baseUrl,
        usingNip60,
        receiveToken,
        tokenAmount,
        selectedModel,
        sendToken,
        activeMintUrl,
        retryOnInsufficientBalance
      });
    }

    return response;
  };

  try {
    const response = await makeRequest();

    if (!response.body) {
      throw new Error('Response body is not available');
    }

    const accumulatedContent = await processStreamingResponse(response, onStreamingUpdate);

    if (accumulatedContent) {
      onMessagesUpdate([...messageHistory, createTextMessage('assistant', accumulatedContent)]);
    }

    // Handle refund and balance update
    await handlePostResponseRefund({
      mintUrl,
      baseUrl,
      usingNip60,
      receiveToken,
      tokenAmount,
      initialBalance,
      selectedModel,
      onBalanceUpdate,
      onTransactionUpdate,
      transactionHistory
    });

  } catch (error) {
    console.log('API Error: ', error);
    handleApiResponseError(error, messageHistory, onMessagesUpdate);
  }
};

/**
 * Handles API errors and retry logic
 */
async function handleApiError(
  response: Response,
  params: {
    mintUrl: string;
    baseUrl: string;
    usingNip60: boolean;
    receiveToken: (token: string) => Promise<any[]>;
    tokenAmount: number;
    selectedModel: any;
    sendToken?: (mintUrl: string, amount: number) => Promise<any[]>;
    activeMintUrl?: string | null;
    retryOnInsufficientBalance: boolean;
  }
): Promise<void> {
  const {
    mintUrl,
    baseUrl,
    usingNip60,
    receiveToken,
    tokenAmount,
    selectedModel,
    sendToken,
    activeMintUrl,
    retryOnInsufficientBalance
  } = params;

  if (response.status === 401 || response.status === 403) {
    const storedToken = localStorage.getItem("current_cashu_token");
    let shouldAttemptUnifiedRefund = true;

    if (storedToken) {
      try {
        await receiveToken(storedToken);
        shouldAttemptUnifiedRefund = false;
      } catch (receiveError) {
        if (receiveError instanceof Error && receiveError.message.includes('Token already spent')) {
          shouldAttemptUnifiedRefund = true;
        } else {
          console.error("Error receiving token:", receiveError);
          shouldAttemptUnifiedRefund = true;
        }
      }
    }

    if (shouldAttemptUnifiedRefund) {
      await unifiedRefund(mintUrl, baseUrl, usingNip60, receiveToken);
    }
    
    clearCurrentApiToken();
    
    if (retryOnInsufficientBalance) {
      const newToken = await getTokenForRequest(
        usingNip60,
        mintUrl,
        tokenAmount,
        sendToken,
        activeMintUrl
      );

      if (!newToken || (typeof newToken === 'object' && 'hasTokens' in newToken && !newToken.hasTokens)) {
        throw new Error(`Insufficient balance. Please add more funds to continue. You need at least ${Number(tokenAmount).toFixed(0)} sats to use ${selectedModel?.id}`);
      }
    }
  } else if (response.status === 402) {
    clearCurrentApiToken();
  } else if (response.status === 413) {
    await unifiedRefund(mintUrl, baseUrl, usingNip60, receiveToken);
  }

  if (!retryOnInsufficientBalance) {
    throw new Error(`API error: ${response.status}`);
  }
}

/**
 * Processes streaming response from the API
 */
async function processStreamingResponse(
  response: Response,
  onStreamingUpdate: (content: string) => void
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulatedContent = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });

    try {
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith('data: ')) {
          const jsonData = line.slice(6);

          if (jsonData === '[DONE]') continue;

          try {
            const parsedData = JSON.parse(jsonData);

            if (parsedData.choices &&
              parsedData.choices[0] &&
              parsedData.choices[0].delta &&
              parsedData.choices[0].delta.content) {

              const newContent = parsedData.choices[0].delta.content;
              accumulatedContent += newContent;
              onStreamingUpdate(accumulatedContent);
            }
          } catch {
            // Swallow parse errors for streaming chunks
          }
        }
      }
    } catch {
      // Swallow chunk processing errors
    }
  }

  return accumulatedContent;
}

/**
 * Handles refund and balance updates after successful response
 */
async function handlePostResponseRefund(params: {
  mintUrl: string;
  baseUrl: string;
  usingNip60: boolean;
  receiveToken: (token: string) => Promise<any[]>;
  tokenAmount: number;
  initialBalance: number;
  selectedModel: any;
  onBalanceUpdate: (balance: number) => void;
  onTransactionUpdate: (transaction: TransactionHistory) => void;
  transactionHistory: TransactionHistory[];
}): Promise<void> {
  const {
    mintUrl,
    baseUrl,
    usingNip60,
    receiveToken,
    tokenAmount,
    initialBalance,
    selectedModel,
    onBalanceUpdate,
    onTransactionUpdate,
    transactionHistory
  } = params;

  let satsSpent: number;

  const result = await unifiedRefund(mintUrl, baseUrl, usingNip60, receiveToken);
  if (result.success) {
    if (usingNip60 && result.refundedAmount !== undefined) {
      satsSpent = Math.ceil(tokenAmount) - result.refundedAmount;
      onBalanceUpdate(initialBalance - satsSpent);
    } else {
      const { apiBalance, proofsBalance } = await fetchBalances(mintUrl, baseUrl);
      onBalanceUpdate(Math.floor(apiBalance / 1000) + Math.floor(proofsBalance / 1000));
      satsSpent = initialBalance - getBalanceFromStoredProofs();
    }
  } else {
    console.error("Refund failed:", result.message);
    satsSpent = Math.ceil(tokenAmount);
  }

  const newTransaction: TransactionHistory = {
    type: 'spent',
    amount: satsSpent,
    timestamp: Date.now(),
    status: 'success',
    model: selectedModel?.id,
    message: 'Tokens spent',
    balance: initialBalance - satsSpent
  };

  localStorage.setItem('transaction_history', JSON.stringify([...transactionHistory, newTransaction]));
  onTransactionUpdate(newTransaction);
}

/**
 * Handles errors in API responses and adds error messages to chat
 */
function handleApiResponseError(
  error: unknown,
  messageHistory: Message[],
  onMessagesUpdate: (messages: Message[]) => void
): void {
  let errorMessage = 'Failed to process your request';
  
  if (error instanceof TypeError && error.message.includes('NetworkError when attempting to fetch resource.')) {
    errorMessage = 'Your provider is down. Please switch the provider in settings.';
  } else {
    errorMessage = error instanceof Error ? error.message : 'Failed to process your request';
  }

  onMessagesUpdate([...messageHistory, createTextMessage('system', errorMessage)]);
}