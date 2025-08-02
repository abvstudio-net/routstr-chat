import { Message, TransactionHistory } from '@/types/chat';
import { convertMessageForAPI, createTextMessage } from './messageUtils';
import { getTokenForRequest, getTokenAmountForModel, clearCurrentApiToken } from './tokenUtils';
import { fetchBalances, getBalanceFromStoredProofs, refundRemainingBalance, unifiedRefund } from '@/utils/cashuUtils';
import { getLocalCashuToken } from './storageUtils';
import { extractThinkingFromStream, isThinkingCapableModel } from './thinkingParser';

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
  onMessageAppend: (message: Message) => void;
  onBalanceUpdate: (balance: number) => void;
  onTransactionUpdate: (transaction: TransactionHistory) => void;
  transactionHistory: TransactionHistory[];
  onTokenCreated: (amount: number) => void;
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
    onMessageAppend,
    onBalanceUpdate,
    onTransactionUpdate,
    transactionHistory,
    onTokenCreated
  } = params;

  const initialBalance = usingNip60 ? balance : getBalanceFromStoredProofs();
  const tokenAmount = getTokenAmountForModel(selectedModel);

  const makeRequest = async (retryOnInsufficientBalance: boolean = true): Promise<Response> => {
    const token = await getTokenForRequest(
      usingNip60,
      mintUrl,
      tokenAmount,
      baseUrl, // Add baseUrl here
      sendToken,
      activeMintUrl
    );
    
    if (token) {
      let roundedTokenAmount = tokenAmount;
      if (roundedTokenAmount % 1 !== 0) {
        roundedTokenAmount = Math.ceil(roundedTokenAmount);
      }
      onTokenCreated(roundedTokenAmount);
    }

    if (!token) {
      throw new Error(`Insufficient balance. Please add more funds to continue. You need at least ${Number(tokenAmount).toFixed(0)} sats to use ${selectedModel?.id}`);
    }

    if (typeof token === 'object' && 'hasTokens' in token && !token.hasTokens) {
      throw new Error(`Insufficient balance. Please add more funds to continue. You need at least ${Number(tokenAmount).toFixed(0)} sats to use ${selectedModel?.id}`);
    }

    // Convert messages to API format
    // Filter out system messages (error messages) before sending to API
    const apiMessages = messageHistory
      .filter(message => message.role !== 'system')
      .map(convertMessageForAPI);

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
      console.error("rdlogs:rdlogs:inside make request", response)
      await handleApiError(response, {
        mintUrl,
        baseUrl,
        usingNip60,
        receiveToken,
        tokenAmount,
        selectedModel,
        sendToken,
        activeMintUrl,
        retryOnInsufficientBalance,
        messageHistory,
        onMessagesUpdate,
        onMessageAppend
      });
    }

    return response;
  };

  try {
    const response = await makeRequest();

    if (!response.body) {
      throw new Error('Response body is not available');
    }

    const streamingResult = await processStreamingResponse(response, onStreamingUpdate, selectedModel?.id);

    if (streamingResult.content) {
      const assistantMessage = createTextMessage('assistant', streamingResult.content);
      if (streamingResult.thinking) {
        assistantMessage.thinking = streamingResult.thinking;
      }
      onMessagesUpdate([...messageHistory, assistantMessage]);
    }

    let estimatedCosts = 0; // Initialize to 0
    // Log usage statistics if available
    if (streamingResult.usage) {
      if ( streamingResult.usage.completion_tokens !== undefined && streamingResult.usage.prompt_tokens !== undefined) {
        estimatedCosts = selectedModel?.sats_pricing.completion * streamingResult.usage.completion_tokens + selectedModel?.sats_pricing.prompt * streamingResult.usage.prompt_tokens
        console.log("Estimated costs: ", estimatedCosts);
      }
    }

    onStreamingUpdate('');

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
      transactionHistory,
      messageHistory,
      onMessagesUpdate,
      onMessageAppend,
      estimatedCosts // Pass estimatedCosts here
    });
    console.log("rdlogs:rdlogs: respon 23242342", response)

  } catch (error) {
    console.log('API Error: ', error);
    handleApiResponseError(error, onMessageAppend);
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
    messageHistory: Message[];
    onMessagesUpdate: (messages: Message[]) => void;
    onMessageAppend: (message: Message) => void;
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
    retryOnInsufficientBalance,
    messageHistory,
    onMessagesUpdate,
    onMessageAppend
  } = params;

  if (response.status === 401 || response.status === 403) {
    handleApiResponseError(response.statusText + ". Trying to get a refund. ", onMessageAppend);
    const storedToken = getLocalCashuToken(baseUrl);
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
      const refundStatus = await unifiedRefund(mintUrl, baseUrl, usingNip60, receiveToken);
      if (!refundStatus.success){
        handleApiResponseError("Refund failed: " + refundStatus.message, onMessageAppend);
      }
    }
    
    clearCurrentApiToken(baseUrl); // Pass baseUrl here
    
    if (retryOnInsufficientBalance) {
      const newToken = await getTokenForRequest(
        usingNip60,
        mintUrl,
        tokenAmount,
        baseUrl, // Add baseUrl here
        sendToken,
        activeMintUrl
      );

      if (!newToken || (typeof newToken === 'object' && 'hasTokens' in newToken && !newToken.hasTokens)) {
        throw new Error(`Insufficient balance. Please add more funds to continue. You need at least ${Number(tokenAmount).toFixed(0)} sats to use ${selectedModel?.id}`);
      }
    }
  } 
  else if (response.status === 402) {
    clearCurrentApiToken(baseUrl); // Pass baseUrl here
  } 
  else if (response.status === 413) {
    const refundStatus = await unifiedRefund(mintUrl, baseUrl, usingNip60, receiveToken);
    if (!refundStatus.success){
      handleApiResponseError("Refund failed: " + refundStatus.message, onMessageAppend);
    }
  }
  else if (response.status === 500) {
    console.error("rdlogs:rdlogs:internal errror finassld");
  }
  else {
    console.error("rdlogs:rdlogs:smh else else ", response);
  }

  if (!retryOnInsufficientBalance) {
    throw new Error(`API error: ${response.status}`);
  }
}

/**
 * Processes streaming response from the API
 */
interface StreamingResult {
  content: string;
  thinking?: string;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  model?: string;
  finish_reason?: string;
}

async function processStreamingResponse(
  response: Response,
  onStreamingUpdate: (content: string) => void,
  modelId?: string
): Promise<StreamingResult> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulatedContent = '';
  let accumulatedThinking = '';
  let isInThinking = false;
  let usage: StreamingResult['usage'];
  let model: string | undefined;
  let finish_reason: string | undefined;

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

            // Handle content delta
            if (parsedData.choices &&
              parsedData.choices[0] &&
              parsedData.choices[0].delta &&
              parsedData.choices[0].delta.content) {

              const newContent = parsedData.choices[0].delta.content;
              
              if (modelId && isThinkingCapableModel(modelId)) {
                const thinkingResult = extractThinkingFromStream(newContent, accumulatedThinking);
                accumulatedThinking = thinkingResult.thinking;
                isInThinking = thinkingResult.isInThinking;
                
                if (thinkingResult.content) {
                  accumulatedContent += thinkingResult.content;
                  onStreamingUpdate(accumulatedContent);
                }
              } else {
                accumulatedContent += newContent;
                onStreamingUpdate(accumulatedContent);
              }
            }

            // Handle usage statistics (usually in the final chunk)
            if (parsedData.usage) {
              usage = {
                total_tokens: parsedData.usage.total_tokens,
                prompt_tokens: parsedData.usage.prompt_tokens,
                completion_tokens: parsedData.usage.completion_tokens
              };
            }

            // Handle model information
            if (parsedData.model) {
              model = parsedData.model;
            }

            // Handle finish reason
            if (parsedData.choices &&
              parsedData.choices[0] &&
              parsedData.choices[0].finish_reason) {
              finish_reason = parsedData.choices[0].finish_reason;
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

  return {
    content: accumulatedContent,
    thinking: (modelId && isThinkingCapableModel(modelId) && accumulatedThinking) ? accumulatedThinking : undefined,
    usage,
    model,
    finish_reason
  };
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
  messageHistory: Message[];
  onMessagesUpdate: (messages: Message[]) => void;
  onMessageAppend: (message: Message) => void;
  estimatedCosts: number; // Add estimatedCosts here
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
    transactionHistory,
    messageHistory,
    onMessagesUpdate,
    onMessageAppend,
    estimatedCosts // Destructure estimatedCosts here
  } = params;

  let satsSpent: number;

  const refundStatus = await unifiedRefund(mintUrl, baseUrl, usingNip60, receiveToken);
  if (refundStatus.success) {
    if (usingNip60 && refundStatus.refundedAmount !== undefined) {
      satsSpent = Math.ceil(tokenAmount) - refundStatus.refundedAmount;
      onBalanceUpdate(initialBalance - satsSpent);
    } else {
      const { apiBalance, proofsBalance } = await fetchBalances(mintUrl, baseUrl);
      onBalanceUpdate(Math.floor(apiBalance / 1000) + Math.floor(proofsBalance / 1000));
      satsSpent = initialBalance - getBalanceFromStoredProofs();
    }
  } else {
    console.error("Refund failed:", refundStatus.message);
    if (refundStatus.message && refundStatus.message.includes("Balance too small to refund")) {
      clearCurrentApiToken(baseUrl); // Pass baseUrl here
    }
    else {
      handleApiResponseError("Refund failed: " + refundStatus.message, onMessageAppend);
    }
    satsSpent = Math.ceil(tokenAmount);
  }
  console.log("spent: ", satsSpent)
  const netCosts = satsSpent - estimatedCosts;
  if (netCosts > 1){
    handleApiResponseError("ATTENTION: Looks like this provider is overcharging you for your query. Estimated Costs: " + Math.ceil(estimatedCosts) +". Actual Costs: " + satsSpent, onMessageAppend);
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
  onMessageAppend: (message: Message) => void
): void {
  let errorMessage = 'Failed to process your request';
  
  if (error instanceof TypeError && error.message.includes('NetworkError when attempting to fetch resource.')) {
    errorMessage = 'Your provider is down. Please switch the provider in settings.';
  } else {
    errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Failed to process your request');
  }

  onMessageAppend(createTextMessage('system', errorMessage));
}