import { Conversation, Message } from '@/types/chat';
import { getTextFromContent, stripImageDataFromMessages } from './messageUtils';

const CONVERSATIONS_STORAGE_KEY = 'saved_conversations';
const CONVERSATIONS_UPDATED_AT_KEY = 'saved_conversations_updated_at';

const hasLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const getConversationsUpdatedAt = (): number => {
  if (!hasLocalStorage()) return 0;
  const raw = window.localStorage.getItem(CONVERSATIONS_UPDATED_AT_KEY);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const persistConversationsSnapshot = (
  conversations: Conversation[],
  updatedAt?: number
): number => {
  if (!hasLocalStorage()) {
    return typeof updatedAt === 'number' ? updatedAt : Date.now();
  }

  const timestamp = typeof updatedAt === 'number' ? updatedAt : Date.now();

  try {
    window.localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
    window.localStorage.setItem(CONVERSATIONS_UPDATED_AT_KEY, String(timestamp));
  } catch (error) {
    console.error('Error persisting conversations to storage:', error);
  }

  return timestamp;
};

const ensureUpdatedAtExists = () => {
  if (!hasLocalStorage()) return;
  if (!window.localStorage.getItem(CONVERSATIONS_UPDATED_AT_KEY)) {
    window.localStorage.setItem(CONVERSATIONS_UPDATED_AT_KEY, String(Date.now()));
  }
};

/**
 * Generates a title for a conversation based on the first user message
 * @param messages Array of messages in the conversation
 * @param fallbackTitle Default title to use if no user message found
 * @returns Generated title string
 */
export const generateConversationTitle = (messages: Message[], fallbackTitle: string): string => {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const messageText = getTextFromContent(firstUserMessage.content);
    return messageText.length > 30
      ? messageText.substring(0, 30) + '...'
      : messageText;
  }
  return fallbackTitle;
};

/**
 * Saves a conversation to localStorage with optimized message storage
 * @param conversations Current conversations array
 * @param activeConversationId ID of the conversation to save
 * @param messages Current messages in the conversation
 * @returns Updated conversations array
 */
export const saveConversationToStorage = (
  conversations: Conversation[],
  activeConversationId: string,
  messages: Message[]
): Conversation[] => {
  if (!activeConversationId) return conversations;

  const updatedConversations = conversations.map(conversation => {
    if (conversation.id === activeConversationId) {
      // Generate title if needed
      let title = conversation.title;
      if (!title || title.startsWith('Conversation ')) {
        title = generateConversationTitle(messages, conversation.title);
      }

      // Strip image data from messages before saving
      const messagesToSave = stripImageDataFromMessages(messages);

      return {
        ...conversation,
        title: title || conversation.title,
        messages: messagesToSave
      };
    }
    return conversation;
  });

  persistConversationsSnapshot(updatedConversations);
  return updatedConversations;
};

/**
 * Loads conversations from localStorage
 * @returns Array of conversations or empty array if none found
 */
export const loadConversationsFromStorage = (): Conversation[] => {
  if (!hasLocalStorage()) return [];
  try {
    const savedConversationsData = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!savedConversationsData) return [];

    const parsedConversations = JSON.parse(savedConversationsData);
    if (Array.isArray(parsedConversations)) {
      ensureUpdatedAtExists();
      return parsedConversations;
    }
  } catch (error) {
    console.error('Error loading conversations from storage:', error);
  }
  return [];
};

/**
 * Creates a new conversation
 * @param existingConversations Current conversations array
 * @param initialMessages Optional initial messages for the conversation
 * @returns Object with new conversation and updated conversations array
 */
export const createNewConversation = (
  existingConversations: Conversation[],
  initialMessages: Message[] = []
): {
  newConversation: Conversation;
  updatedConversations: Conversation[];
} => {
  const newId = Date.now().toString();
  const messagesToStore = stripImageDataFromMessages(initialMessages);
  const newConversation: Conversation = {
    id: newId,
    title: `Conversation ${existingConversations.length + 1}`,
    messages: messagesToStore
  };

  const updatedConversations = [...existingConversations, newConversation];
  persistConversationsSnapshot(updatedConversations);

  return {
    newConversation,
    updatedConversations
  };
};

/**
 * Deletes a conversation from storage
 * @param conversations Current conversations array
 * @param conversationId ID of conversation to delete
 * @returns Updated conversations array
 */
export const deleteConversationFromStorage = (
  conversations: Conversation[],
  conversationId: string
): Conversation[] => {
  const updatedConversations = conversations.filter(c => c.id !== conversationId);
  persistConversationsSnapshot(updatedConversations);
  return updatedConversations;
};

/**
 * Finds a conversation by ID
 * @param conversations Array of conversations to search
 * @param conversationId ID to search for
 * @returns Found conversation or undefined
 */
export const findConversationById = (
  conversations: Conversation[],
  conversationId: string
): Conversation | undefined => {
  return conversations.find(c => c.id === conversationId);
};

/**
 * Clears all conversations from storage
 */
export const clearAllConversations = (): void => {
  if (!hasLocalStorage()) return;
  window.localStorage.removeItem(CONVERSATIONS_STORAGE_KEY);
  window.localStorage.removeItem(CONVERSATIONS_UPDATED_AT_KEY);
};

/**
 * Updates a specific conversation in the array
 * @param conversations Current conversations array
 * @param conversationId ID of conversation to update
 * @param updates Partial conversation object with updates
 * @returns Updated conversations array
 */
export const updateConversation = (
  conversations: Conversation[],
  conversationId: string,
  updates: Partial<Conversation>
): Conversation[] => {
  const updatedConversations = conversations.map(conversation => {
    if (conversation.id === conversationId) {
      return { ...conversation, ...updates };
    }
    return conversation;
  });

  persistConversationsSnapshot(updatedConversations);
  return updatedConversations;
};
