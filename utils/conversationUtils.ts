import { Conversation, Message } from '@/types/chat';
import { getTextFromContent, stripImageDataFromMessages } from './messageUtils';

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

  localStorage.setItem('saved_conversations', JSON.stringify(updatedConversations));
  return updatedConversations;
};

/**
 * Loads conversations from localStorage
 * @returns Array of conversations or empty array if none found
 */
export const loadConversationsFromStorage = (): Conversation[] => {
  try {
    const savedConversationsData = localStorage.getItem('saved_conversations');
    if (savedConversationsData) {
      const parsedConversations = JSON.parse(savedConversationsData);
      if (Array.isArray(parsedConversations)) {
        return parsedConversations;
      }
    }
    return [];
  } catch (error) {
    console.error('Error loading conversations from storage:', error);
    return [];
  }
};

/**
 * Creates a new conversation
 * @param existingConversations Current conversations array
 * @returns Object with new conversation and updated conversations array
 */
export const createNewConversation = (existingConversations: Conversation[]): {
  newConversation: Conversation;
  updatedConversations: Conversation[];
} => {
  const newId = Date.now().toString();
  const newConversation: Conversation = {
    id: newId,
    title: `Conversation ${existingConversations.length + 1}`,
    messages: []
  };

  const updatedConversations = [...existingConversations, newConversation];
  localStorage.setItem('saved_conversations', JSON.stringify(updatedConversations));

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
  localStorage.setItem('saved_conversations', JSON.stringify(updatedConversations));
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
  localStorage.removeItem('saved_conversations');
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

  localStorage.setItem('saved_conversations', JSON.stringify(updatedConversations));
  return updatedConversations;
};