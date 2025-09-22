import { Message, TransactionHistory, MessageContent as ChatMessageContent } from '@/types/chat';
import { convertMessageForAPI, createTextMessage, createMultimodalMessage } from './messageUtils';
import { getTokenForRequest, getTokenAmountForModel, clearCurrentApiToken } from './tokenUtils';
import { fetchBalances, getBalanceFromStoredProofs, refundRemainingBalance, unifiedRefund } from '@/utils/cashuUtils';
import { getLocalCashuToken } from './storageUtils';
import { extractThinkingFromStream, isThinkingCapableModel } from './thinkingParser';
import { getDecodedToken } from '@cashu/cashu-ts';

export interface FetchAIResponseParams {
  messageHistory: Message[];
  selectedModel: any;
  baseUrl: string;
  mintUrl: string;
  usingNip60: boolean;
  balance: number;
  unit: string;
  sendToken?: (mintUrl: string, amount: number) => Promise<{ proofs: any[], unit: string }>;
  receiveToken: (token: string) => Promise<any[]>;
  activeMintUrl?: string | null;
  onStreamingUpdate: (content: string) => void;
  onThinkingUpdate: (content: string) => void;
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
    unit,
    sendToken,
    receiveToken,
    activeMintUrl,
    onStreamingUpdate,
    onThinkingUpdate,
    onMessagesUpdate,
    onMessageAppend,
    onBalanceUpdate,
    onTransactionUpdate,
    transactionHistory,
    onTokenCreated
  } = params;

  const initialBalance = usingNip60 ? balance : getBalanceFromStoredProofs();

  // Decide whether to stream based on model output modality; image models prefer non-streaming
  const shouldStream: boolean = (() => {
    try {
      if (selectedModel?.architecture?.output_modalities?.includes?.('image')) return false;
      const id = String(selectedModel?.id || '').toLowerCase();
      if (id.includes('image') || id.includes('vision')) return false;
    } catch {}
    return true;
  })();

  // Convert messages to API format
  // Filter out system messages (error messages) before sending to API
  const apiMessages = messageHistory
    .filter(message => message.role !== 'system')
    .map(convertMessageForAPI);

  const approximateTokens = Math.ceil(JSON.stringify(apiMessages, null, 2).length / 3)
  let tokenAmount = getTokenAmountForModel(selectedModel, approximateTokens);

  const makeRequest = async (retryOnInsufficientBalance: boolean = true): Promise<Response> => {
    const token = await getTokenForRequest(
      usingNip60,
      mintUrl,
      usingNip60 && unit == 'msat'? tokenAmount*1000 : tokenAmount,
      baseUrl, // Add baseUrl here
      sendToken,
      activeMintUrl
    );
    
    if (!token) {
      throw new Error(`Insufficient balance. Please add more funds to continue. You need at least ${Number(tokenAmount).toFixed(0)} sats to use ${selectedModel?.id}`);
    }

    if (typeof token === 'object' && 'hasTokens' in token && !token.hasTokens) {
      throw new Error(`Insufficient balance. Please add more funds to continue. You need at least ${Number(tokenAmount).toFixed(0)} sats to use ${selectedModel?.id} ${typeof token} ${token}`);
    }

    if (token && typeof token === 'string') {
      const decodedToken = getDecodedToken(token)
      if (decodedToken.unit == 'msat') {
        onTokenCreated(tokenAmount)
      }
      else {
        let roundedTokenAmount = tokenAmount;
        if (roundedTokenAmount % 1 !== 0) {
          roundedTokenAmount = Math.ceil(roundedTokenAmount);
        }
        onTokenCreated(roundedTokenAmount);
      }
    }


    const response = await fetch(`${baseUrl}v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: selectedModel?.id,
        messages: apiMessages,
        stream: shouldStream
      })
    });

    if (!response.ok) {
      console.error("rdlogs:rdlogs:inside make request", response)
      const retryResponse = await handleApiError(response, {
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
        onMessageAppend,
        makeRequest
      });
      return retryResponse;
    }

    return response;
  };

  try {
    const response = await makeRequest();
    // const response = new Response();

    const contentType = response.headers.get('content-type') || '';

    let streamingResult: StreamingResult = { content: '' };
    if (contentType.includes('text/event-stream')) {
      if (!response.body) {
        throw new Error('Response body is not available');
      }

      streamingResult = await processStreamingResponse(
        response,
        onStreamingUpdate,
        onThinkingUpdate,
        selectedModel?.id
      );
    } else {
      // Fallback for non-streaming JSON responses (e.g., image-only outputs)
      try {
        const json = await response.json();
        const choice = json?.choices?.[0];
        const msg = choice?.message;
        const imagesArray: ChatMessageContent[] = [];
        let textContent = '';

        if (msg) {
          if (typeof msg.content === 'string') {
            textContent = msg.content;
          } else if (Array.isArray(msg.content)) {
            for (const item of msg.content) {
              if (item?.type === 'text' && typeof item.text === 'string') {
                imagesArray.push({ type: 'text', text: item.text });
              } else if (
                item?.type === 'image_url' && item.image_url && typeof item.image_url.url === 'string'
              ) {
                imagesArray.push({ type: 'image_url', image_url: { url: item.image_url.url } });
              }
            }
          }

          if (Array.isArray(msg.images)) {
            for (const img of msg.images) {
              if (img?.type === 'image_url' && img.image_url && typeof img.image_url.url === 'string') {
                imagesArray.push({ type: 'image_url', image_url: { url: img.image_url.url } });
              }
            }
          }
        }

        streamingResult = {
          content: textContent,
          images: imagesArray.length > 0 ? imagesArray.filter(i => i.type === 'image_url') : undefined,
          usage: json?.usage
            ? {
                total_tokens: json.usage.total_tokens,
                prompt_tokens: json.usage.prompt_tokens,
                completion_tokens: json.usage.completion_tokens
              }
            : undefined,
          model: json?.model,
          finish_reason: choice?.finish_reason
        };
      } catch (e) {
        // If parsing fails, fall back to reading as text and showing as error
        console.error('Failed to parse non-streaming response', e);
      }
    }

    if (streamingResult.content || (streamingResult.images && streamingResult.images.length > 0)) {
      let assistantMessage: Message;
      if (streamingResult.images && streamingResult.images.length > 0) {
        const images = streamingResult.images
          .filter((i): i is ChatMessageContent => i && i.type === 'image_url' && !!i.image_url?.url);
        if (images.length > 0) {
          const contentArray: ChatMessageContent[] = [];
          if (streamingResult.content && streamingResult.content.trim().length > 0) {
            contentArray.push({ type: 'text', text: streamingResult.content });
          }
          contentArray.push(...images);
          assistantMessage = { role: 'assistant', content: contentArray };
        } else {
          assistantMessage = createTextMessage('assistant', streamingResult.content || '');
        }
      } else {
        assistantMessage = createTextMessage('assistant', streamingResult.content || '');
      }
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
    onThinkingUpdate('');

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
      estimatedCosts, // Pass estimatedCosts here
      unit // Pass unit here
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
    sendToken?: (mintUrl: string, amount: number) => Promise<{ proofs: any[], unit: string }>;
    activeMintUrl?: string | null;
    retryOnInsufficientBalance: boolean;
    messageHistory: Message[];
    onMessagesUpdate: (messages: Message[]) => void;
    onMessageAppend: (message: Message) => void;
    makeRequest: (retryOnInsufficientBalance: boolean) => Promise<Response>;
  }
): Promise<Response> {
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
    onMessageAppend,
    makeRequest
  } = params;

  if (response.status === 401 || response.status === 403) {
    console.log('rdlogs: ,',response.body)
    const requestId = response.headers.get('x-routstr-request-id');
    const mainMessage = response.statusText + ". Trying to get a refund.";
    const requestIdText = requestId ? `Request ID: ${requestId}` : '';
    const providerText = `Provider: ${baseUrl}`;
    const fullMessage = requestId
      ? `${mainMessage}\n${requestIdText}\n${providerText}`
      : `${mainMessage} | ${providerText}`;
    handleApiResponseError(fullMessage, onMessageAppend);
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
        const mainMessage = `Refund failed: ${refundStatus.message}.`;
        const requestIdText = refundStatus.requestId ? `Request ID: ${refundStatus.requestId}` : '';
        const providerText = `Provider: ${baseUrl}`;
        const fullMessage = refundStatus.requestId
          ? `${mainMessage}\n${requestIdText}\n${providerText}`
          : `${mainMessage} | ${providerText}`;
        handleApiResponseError(fullMessage, onMessageAppend);
      }
    }
    
    clearCurrentApiToken(baseUrl); // Pass baseUrl here
    
    if (retryOnInsufficientBalance) {
      return await makeRequest(false);
    }
  } 
  else if (response.status === 402) {
    clearCurrentApiToken(baseUrl); // Pass baseUrl here
    if (retryOnInsufficientBalance) {
      return await makeRequest(false);
    }
  } 
  else if (response.status === 413) {
    const refundStatus = await unifiedRefund(mintUrl, baseUrl, usingNip60, receiveToken);
    if (!refundStatus.success){
      const mainMessage = `Refund failed: ${refundStatus.message}.`;
      const requestIdText = refundStatus.requestId ? `Request ID: ${refundStatus.requestId}` : '';
      const providerText = `Provider: ${baseUrl}`;
      const fullMessage = refundStatus.requestId
        ? `${mainMessage}\n${requestIdText}\n${providerText}`
        : `${mainMessage} | ${providerText}`;
      handleApiResponseError(fullMessage, onMessageAppend);
      return response;
    }
    else {
      if (retryOnInsufficientBalance) {
        return await makeRequest(false);
      }
    }
  }
  else if (response.status === 500) {
    console.error("rdlogs:rdlogs:internal errror finassld");
    return response;
  }
  else {
    console.error("rdlogs:rdlogs:smh else else ", response);
    return response;
  }

  if (!retryOnInsufficientBalance) {
    throw new Error(`API error: ${response.status}`);
  }
  return response;
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
  images?: ChatMessageContent[];
}

async function processStreamingResponse(
  response: Response,
  onStreamingUpdate: (content: string) => void,
  onThinkingUpdate: (content: string) => void,
  modelId?: string
): Promise<StreamingResult> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulatedContent = '';
  let accumulatedThinking = '';
  let isInThinking = false;
  let isInContent = false;
  let usage: StreamingResult['usage'];
  let model: string | undefined;
  let finish_reason: string | undefined;
  let images: StreamingResult['images'];
  let partialJson = '';

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

          const toParse = (partialJson ? partialJson : '') + jsonData;

          let parsedData: any;
          try {
            parsedData = JSON.parse(toParse);
            partialJson = '';

            // Handle reasoning delta. OpenRouter does this. 
            if (parsedData.choices &&
              parsedData.choices[0] &&
              parsedData.choices[0].delta &&
              parsedData.choices[0].delta.reasoning) {
              
                let newContent;
                if (!isInThinking) {
                  newContent = "<thinking> " + parsedData.choices[0].delta.reasoning;
                  isInThinking = true;
                }
                else {
                  newContent = parsedData.choices[0].delta.reasoning;
                }
                const thinkingResult = extractThinkingFromStream(newContent, accumulatedThinking);
                accumulatedThinking = thinkingResult.thinking;
                onThinkingUpdate(accumulatedThinking)
              }

            // Handle content delta
            else if (parsedData.choices &&
              parsedData.choices[0] &&
              parsedData.choices[0].delta &&
              parsedData.choices[0].delta.content) {

              if (isInThinking && !isInContent) {
                const newContent = "</thinking>";
                const thinkingResult = extractThinkingFromStream(newContent, accumulatedThinking);
                accumulatedThinking = thinkingResult.thinking;
                onThinkingUpdate(accumulatedThinking);
                
                if (thinkingResult.content) {
                  accumulatedContent += thinkingResult.content;
                  onStreamingUpdate(accumulatedContent);
                }
                isInThinking = false;
                isInContent = true;
              }

              const newContent = parsedData.choices[0].delta.content;
              
              if (modelId && isThinkingCapableModel(modelId)) {
                const thinkingResult = extractThinkingFromStream(newContent, accumulatedThinking);
                accumulatedThinking = thinkingResult.thinking;
                isInThinking = thinkingResult.isInThinking;
                onThinkingUpdate(accumulatedThinking);
                
                if (thinkingResult.content) {
                  accumulatedContent += thinkingResult.content;
                  onStreamingUpdate(accumulatedContent);
                }
              } else {
                accumulatedContent += newContent;
                onStreamingUpdate(accumulatedContent);
              }
            }

            // Handle images (typically present in the final event)
            if (parsedData.choices &&
              parsedData.choices[0] &&
              parsedData.choices[0].message &&
              parsedData.choices[0].message.images && Array.isArray(parsedData.choices[0].message.images)) {
              try {
                const imgs = parsedData.choices[0].message.images
                  .filter((img: any) => img && img.type === 'image_url' && img.image_url && typeof img.image_url.url === 'string')
                  .map((img: any) => ({ type: 'image_url', image_url: { url: img.image_url.url } as { url: string } }));
                if (imgs.length > 0) {
                  images = imgs;
                }
              } catch {
                // Ignore malformed image payloads
              }
            }

            // Some providers include images inside message.content array
            if (parsedData.choices &&
              parsedData.choices[0] &&
              parsedData.choices[0].message &&
              Array.isArray(parsedData.choices[0].message.content)) {
              try {
                const imgsFromContent = parsedData.choices[0].message.content
                  .filter((item: any) => item && item.type === 'image_url' && item.image_url && typeof item.image_url.url === 'string')
                  .map((item: any) => ({ type: 'image_url', image_url: { url: item.image_url.url } as { url: string } }));
                if (imgsFromContent.length > 0) {
                  images = (images ?? []).concat(imgsFromContent);
                }
              } catch {
                // Ignore malformed content payloads
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
            // Keep accumulating until we have a complete JSON event
            partialJson = toParse;
          }
        }
      }
    } catch {
      // Swallow chunk processing errors
    }
  }

  // Attempt to parse any leftover partial JSON from SSE
  if (partialJson && partialJson.trim().length > 0) {
    try {
      const parsedData = JSON.parse(partialJson);

      if (parsedData.choices && parsedData.choices[0] && parsedData.choices[0].message) {
        const msg = parsedData.choices[0].message;
        // Extract images from message.images
        if (Array.isArray(msg.images)) {
          try {
            const imgs = msg.images
              .filter((img: any) => img && img.type === 'image_url' && img.image_url && typeof img.image_url.url === 'string')
              .map((img: any) => ({ type: 'image_url', image_url: { url: img.image_url.url } as { url: string } }));
            if (imgs.length > 0) {
              images = (images ?? []).concat(imgs);
            }
          } catch {}
        }
        // Extract images from message.content blocks
        if (Array.isArray(msg.content)) {
          try {
            const imgsFromContent = msg.content
              .filter((item: any) => item && item.type === 'image_url' && item.image_url && typeof item.image_url.url === 'string')
              .map((item: any) => ({ type: 'image_url', image_url: { url: item.image_url.url } as { url: string } }));
            if (imgsFromContent.length > 0) {
              images = (images ?? []).concat(imgsFromContent);
            }
          } catch {}
        }
      }

      if (parsedData.usage) {
        usage = {
          total_tokens: parsedData.usage.total_tokens,
          prompt_tokens: parsedData.usage.prompt_tokens,
          completion_tokens: parsedData.usage.completion_tokens
        };
      }
      if (parsedData.model) {
        model = parsedData.model;
      }
      if (parsedData.choices && parsedData.choices[0] && parsedData.choices[0].finish_reason) {
        finish_reason = parsedData.choices[0].finish_reason;
      }
    } catch {
      // ignore
    }
  }

  return {
    content: accumulatedContent,
    thinking: (modelId && accumulatedThinking) ? accumulatedThinking : undefined,
    usage,
    model,
    finish_reason,
    images
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
  unit: string; // Add unit here
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
    estimatedCosts, // Destructure estimatedCosts here
    unit // Destructure unit here
  } = params;

  let satsSpent: number;


  const refundStatus = await unifiedRefund(mintUrl, baseUrl, usingNip60, receiveToken);
  if (refundStatus.success) {
    if (usingNip60 && refundStatus.refundedAmount !== undefined) {
      console.log("rdlogs:rdlogs:refunded amount", refundStatus.refundedAmount);
      // For msats, keep decimal precision; for sats, use Math.ceil
      satsSpent = (unit === 'msat' ? tokenAmount : Math.ceil(tokenAmount)) - refundStatus.refundedAmount;
      onBalanceUpdate(initialBalance - satsSpent);
    } else {
      console.log("rdlogs:rdlogs:fetching balances");
      const { apiBalance, proofsBalance } = await fetchBalances(mintUrl, baseUrl);
      onBalanceUpdate(Math.floor(apiBalance / 1000) + Math.floor(proofsBalance / 1000));
      satsSpent = initialBalance - getBalanceFromStoredProofs();
    }
  } else {
    console.error("Refund failed:", refundStatus.message, refundStatus, refundStatus, refundStatus, refundStatus, refundStatus);
    if (refundStatus.message && refundStatus.message.includes("Balance too small to refund")) {
      clearCurrentApiToken(baseUrl); // Pass baseUrl here
    }
    else if (refundStatus.message && refundStatus.message.includes("Refund request failed with status 401")) {
      const mainMessage = `Refund failed: ${refundStatus.message}. Clearing token. Pls retry.`;
      const requestIdText = refundStatus.requestId ? `Request ID: ${refundStatus.requestId}` : '';
      const providerText = `Provider: ${baseUrl}`;
      const fullMessage = refundStatus.requestId
        ? `${mainMessage}\n${requestIdText}\n${providerText}`
        : `${mainMessage} | ${providerText}`;
      handleApiResponseError(fullMessage, onMessageAppend);
      clearCurrentApiToken(baseUrl); // Pass baseUrl here
    }
    else {
      const mainMessage = `Refund failed: ${refundStatus.message}.`;
      const requestIdText = refundStatus.requestId ? `Request ID: ${refundStatus.requestId}` : '';
      const providerText = `Provider: ${baseUrl}`;
      const fullMessage = refundStatus.requestId
        ? `${mainMessage}\n${requestIdText}\n${providerText}`
        : `${mainMessage} | ${providerText}`;
      handleApiResponseError(fullMessage, onMessageAppend);
    }
    // For msats, keep decimal precision; for sats, use Math.ceil
    satsSpent = unit === 'msat' ? tokenAmount : Math.ceil(tokenAmount);
  }
  console.log("rdlogs:rdlogs:spent: ", satsSpent)
  const netCosts = satsSpent - estimatedCosts;
  
  // Use different thresholds based on unit
  const overchargeThreshold = unit === 'msat' ? 0.05 : 1;
  if (netCosts > overchargeThreshold){
    const estimatedDisplay = unit === 'msat' ? estimatedCosts.toFixed(3) : Math.ceil(estimatedCosts).toString();
    const actualDisplay = unit === 'msat' ? satsSpent.toFixed(3) : satsSpent.toString();
    handleApiResponseError("ATTENTION: Looks like this provider is overcharging you for your query. Estimated Costs: " + estimatedDisplay +". Actual Costs: " + actualDisplay, onMessageAppend);
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