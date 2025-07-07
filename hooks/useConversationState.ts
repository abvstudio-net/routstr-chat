import { useState, useEffect, useCallback } from 'react';
import { Conversation, Message } from '@/types/chat';
import {
  loadConversationsFromStorage,
  saveConversationToStorage,
  createNewConversation,
  deleteConversationFromStorage,
  findConversationById,
  clearAllConversations
} from '@/utils/conversationUtils';
import { getTextFromContent } from '@/utils/messageUtils';

export interface UseConversationStateReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  editingMessageIndex: number | null;
  editingContent: string;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  setEditingMessageIndex: (index: number | null) => void;
  setEditingContent: (content: string) => void;
  createNewConversationHandler: () => void;
  loadConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string, e: React.MouseEvent) => void;
  clearConversations: () => void;
  startEditingMessage: (index: number) => void;
  cancelEditing: () => void;
  saveCurrentConversation: () => void;
}

/**
 * Custom hook for managing conversation and message state
 * Handles conversation CRUD operations, message state management,
 * active conversation tracking, and conversation persistence
 */
export const useConversationState = (): UseConversationStateReturn => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Load conversations from storage on mount
  useEffect(() => {
    const loadedConversations = loadConversationsFromStorage();
    setConversations(loadedConversations);
  }, []);

  // Save current conversation whenever messages change
  const saveCurrentConversation = useCallback(() => {
    if (!activeConversationId) return;

    setConversations(prevConversations => {
      return saveConversationToStorage(
        prevConversations,
        activeConversationId,
        messages
      );
    });
  }, [activeConversationId, messages]);

  // Auto-save conversation when messages change
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      saveCurrentConversation();
    }
  }, [messages, activeConversationId, saveCurrentConversation]);

  // Set editing content when editing message index changes
  useEffect(() => {
    if (editingMessageIndex !== null && messages[editingMessageIndex]) {
      const messageText = getTextFromContent(messages[editingMessageIndex].content);
      setEditingContent(messageText);
    }
  }, [editingMessageIndex, messages]);

  const createNewConversationHandler = useCallback(() => {
    setConversations(prevConversations => {
      const { newConversation, updatedConversations } = createNewConversation(prevConversations);
      setActiveConversationId(newConversation.id);
      // Only clear messages if there are no messages currently
      // This prevents clearing messages when creating a conversation mid-send
      // setMessages(prevMessages => prevMessages.length === 0 ? [] : prevMessages);
      setMessages([]);
      return updatedConversations;
    });
  }, []);

  const loadConversation = useCallback((conversationId: string) => {
    setConversations(prevConversations => {
      const conversation = findConversationById(prevConversations, conversationId);
      if (conversation) {
        setActiveConversationId(conversationId);
        setMessages(conversation.messages);
      }
      return prevConversations;
    });
  }, []);

  const deleteConversation = useCallback((conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setConversations(prevConversations => {
      const updatedConversations = deleteConversationFromStorage(prevConversations, conversationId);
      
      if (conversationId === activeConversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
      
      return updatedConversations;
    });
  }, [activeConversationId]);

  const clearConversations = useCallback(() => {
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    clearAllConversations();
  }, []);

  const startEditingMessage = useCallback((index: number) => {
    setEditingMessageIndex(index);
    const messageText = getTextFromContent(messages[index].content);
    setEditingContent(messageText);
  }, [messages]);

  const cancelEditing = useCallback(() => {
    setEditingMessageIndex(null);
    setEditingContent('');
  }, []);

  return {
    conversations,
    activeConversationId,
    messages,
    editingMessageIndex,
    editingContent,
    setConversations,
    setActiveConversationId,
    setMessages,
    setEditingMessageIndex,
    setEditingContent,
    createNewConversationHandler,
    loadConversation,
    deleteConversation,
    clearConversations,
    startEditingMessage,
    cancelEditing,
    saveCurrentConversation
  };
};