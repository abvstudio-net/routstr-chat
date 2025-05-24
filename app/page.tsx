'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNostr } from '@/context/NostrContext';
import { getBalanceFromStoredProofs, getOrCreateApiToken, invalidateApiToken } from '@/utils/cashuUtils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  X,
  ChevronDown,
  MessageSquare,
  Trash2,
  Edit,
  Loader2,
  Send,
  PlusCircle,
  Menu,
  Settings,
} from 'lucide-react';
import { Model, getModelNameWithoutProvider } from '@/data/models';
import ReactMarkdown from 'react-markdown';
import SettingsModal from '@/components/SettingsModal';
import LoginModal from '@/components/LoginModal';

// Types
interface Message {
  role: string;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

// Custom hook to get window dimensions
function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('focusin', handleResize);
    window.addEventListener('focusout', handleResize);
    window.addEventListener('visibilitychange', handleResize);

    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focusin', handleResize);
      window.removeEventListener('focusout', handleResize);
      window.removeEventListener('visibilitychange', handleResize);
    };
  }, []);

  return windowSize;
}

function ChatPageContent() {
  const { isAuthenticated, logout } = useNostr();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // State management
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mintUrl, setMintUrl] = useState('https://mint.minibits.cash/Bitcoin');

  // UI state
  const [isModelDrawerOpen, setIsModelDrawerOpen] = useState(false);
  const modelDrawerRef = useRef<HTMLDivElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Responsive design
  const isMobile = useMediaQuery('(max-width: 768px)');
  useWindowSize(); // Call for side effects only

  // Close model drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isModelDrawerOpen && modelDrawerRef.current && 
          !modelDrawerRef.current.contains(event.target as Node)) {
        setIsModelDrawerOpen(false);
      }
    };

    if (isModelDrawerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDrawerOpen]);

  // Model search query - we only need the value, not the setter
  const modelSearchQuery = '';

  // Define saveCurrentConversation before it's used in useEffect
  const saveCurrentConversation = useCallback(() => {
    if (!activeConversationId) return;

    setConversations(prevConversations => {
      let title = prevConversations.find(c => c.id === activeConversationId)?.title;
      if (!title || title.startsWith('Conversation ')) {
        const firstUserMessage = messages.find(m => m.role === 'user')?.content;
        if (firstUserMessage) {
          title = firstUserMessage.length > 30
            ? firstUserMessage.substring(0, 30) + '...'
            : firstUserMessage;
        }
      }

      const updatedConversations = prevConversations.map(conversation => {
        if (conversation.id === activeConversationId) {
          return {
            ...conversation,
            title: title || conversation.title,
            messages: [...messages]
          };
        }
        return conversation;
      });
      localStorage.setItem('saved_conversations', JSON.stringify(updatedConversations));
      return updatedConversations;
    });
  }, [activeConversationId, messages]);

  // Fetch available models from API and handle URL model selection
  const fetchModels = useCallback(async () => {
    try {
      setIsLoadingModels(true);
      const response = await fetch('https://api.routstr.com/');

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.models && Array.isArray(data.models)) {
        setModels(data.models);

        // Get model ID from URL if present
        const urlModelId = searchParams.get('model');
        
        if (urlModelId) {
          // Find the model from the URL parameter
          const urlModel = data.models.find((m: Model) => m.id === urlModelId);
          if (urlModel) {
            setSelectedModel(urlModel);
            localStorage.setItem('lastUsedModel', urlModelId);
            return;
          }
        }

        // If no URL model or model not found, use last used or first available
        const lastUsedModelId = localStorage.getItem('lastUsedModel');
        if (lastUsedModelId) {
          const lastModel = data.models.find((m: Model) => m.id === lastUsedModelId);
          if (lastModel) {
            setSelectedModel(lastModel);
          } else if (data.models.length > 0) {
            setSelectedModel(data.models[0]);
          }
        } else if (data.models.length > 0) {
          setSelectedModel(data.models[0]);
        }
      }
    } catch {
      setModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, [searchParams]);

  // Get user balance and saved conversations from localStorage on page load
  useEffect(() => {
    setAuthChecked(true);

    if (authChecked && !isAuthenticated) {
      setIsLoginModalOpen(true);
      return;
    }

    if (isAuthenticated) {
      setIsLoginModalOpen(false);
      const storedMintUrl = localStorage.getItem('mint_url');
      if (storedMintUrl) {
        setMintUrl(storedMintUrl);
      }

      const loadData = async () => {
        await refreshBalance();
        const savedConversationsData = localStorage.getItem('saved_conversations');
        if (savedConversationsData) {
          try {
            const parsedConversations = JSON.parse(savedConversationsData);
            if (Array.isArray(parsedConversations)) {
              setConversations(parsedConversations);
            } else {
              setConversations([]);
            }
          } catch {
            setConversations([]);
          }
        } else {
          setConversations([]);
        }
        fetchModels();
      };
      loadData();
    }
  }, [isAuthenticated, router, authChecked, fetchModels]);

  // iOS Safari viewport height stabilization
  useEffect(() => {
    if (typeof window !== 'undefined' && isMobile) {
      const timerId = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 500);

      return () => clearTimeout(timerId);
    }
  }, [isMobile]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // When streaming content updates, scroll to bottom
  useEffect(() => {
    if (streamingContent && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingContent]);

  // Save current conversation to localStorage whenever it changes
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      saveCurrentConversation();
    }
  }, [messages, activeConversationId, saveCurrentConversation]);

  // Save mintUrl to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('mint_url', mintUrl);
  }, [mintUrl]);

  // Set input message to the content of the message being edited
  useEffect(() => {
    if (editingMessageIndex !== null && messages[editingMessageIndex]) {
      setEditingContent(messages[editingMessageIndex].content);
    }
  }, [editingMessageIndex, messages]);

  const startEditingMessage = (index: number) => {
    setEditingMessageIndex(index);
    setEditingContent(messages[index].content);
  };

  const cancelEditing = () => {
    setEditingMessageIndex(null);
    setEditingContent('');
  };

  const saveInlineEdit = async () => {
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

      await fetchAIResponse(truncatedMessages);
    }
  };

  const fetchAIResponse = async (messageHistory: Array<{ role: string, content: string }>) => {
    setIsLoading(true);
    setStreamingContent('');

    try {
      const token = await getOrCreateApiToken(mintUrl, 12);

      if (!token) {
        throw new Error('Failed to get or create token. Please check your balance.');
      }

      const response = await fetch('https://api.routstr.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model: selectedModel?.id,
          messages: messageHistory,
          stream: true
        })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          invalidateApiToken();
          throw new Error('Token expired. Please try again.');
        }
        throw new Error(`API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is not available');
      }

      const reader = response.body.getReader();
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

                  setStreamingContent(accumulatedContent);
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

      if (accumulatedContent) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: accumulatedContent
        }]);
      }

      setStreamingContent('');

      await refreshBalance();

    } catch (error) {
      // Only add error to chat, don't use unused error state
      const errorMessage = error instanceof Error ? error.message : 'Failed to process your request';

      setMessages(prev => [...prev, {
        role: 'system',
        content: errorMessage
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!isAuthenticated) {
      setIsLoginModalOpen(true);
      return;
    }

    if (!inputMessage.trim()) return;

    if (!activeConversationId) {
      createNewConversation();
    }

    const userMessage = { role: 'user', content: inputMessage };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    setInputMessage('');

    await fetchAIResponse(updatedMessages);
  };

  

  const createNewConversation = () => {
    const newId = Date.now().toString();
    const newConversation = {
      id: newId,
      title: `Conversation ${conversations.length + 1}`,
      messages: []
    };

    setConversations(prev => [...prev, newConversation]);
    setActiveConversationId(newId);
    setMessages([]);

    localStorage.setItem('saved_conversations', JSON.stringify([...conversations, newConversation]));
  };

  const loadConversation = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setActiveConversationId(conversationId);
      setMessages(conversation.messages);
    }
  };

  const deleteConversation = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const updatedConversations = conversations.filter(c => c.id !== conversationId);
    setConversations(updatedConversations);

    if (conversationId === activeConversationId) {
      setActiveConversationId(null);
      setMessages([]);
    }

    localStorage.setItem('saved_conversations', JSON.stringify(updatedConversations));
  };

  const handleModelChange = (modelId: string) => {
    const model = models.find((m: Model) => m.id === modelId);
    if (model) {
      setSelectedModel(model);
      localStorage.setItem('lastUsedModel', modelId);
    }
  };

  const filteredModels = models.filter((model: Model) =>
    model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    model.id.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    (model.description && model.description.toLowerCase().includes(modelSearchQuery.toLowerCase()))
  );

  const refreshBalance = async () => {
    try {
      const token = await getOrCreateApiToken(mintUrl, 12);
      const response = await fetch('https://api.routstr.com/v1/wallet/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch wallet balance');
      }

      const data = await response.json();
      const apiBalance = Math.floor(data.balance / 1000);
      const proofsBalance = getBalanceFromStoredProofs();
      setBalance(apiBalance + proofsBalance);
    } catch (error) {
      // Fall back to just proofs balance if API fails
      setBalance(getBalanceFromStoredProofs());
    }
  };

  const clearConversations = () => {
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    localStorage.removeItem('cashu_proofs');
    localStorage.removeItem('saved_conversations');
    setBalance(0);
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-black">
        <Loader2 className="h-8 w-8 text-white/50 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden">
      {/* Mobile Sidebar Toggle */}
      {isMobile && !isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed z-30 top-[30px] transform -translate-y-1/2 left-4 bg-black rounded-full p-1.5 shadow-md border border-white/10 hover:bg-white/5 cursor-pointer"
        >
          <Menu className="h-4 w-4 text-white/70" />
        </button>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <div
          className={`fixed inset-0 bg-black/70 z-40 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar container with relative positioning for absolute toggle button */}
      {isAuthenticated && (
        <div className="relative h-full flex-shrink-0 z-50">
          {/* Sidebar */}
          <div
            className={`${isMobile ?
              (isSidebarOpen ? 'fixed inset-0 z-50 w-72 translate-x-0' : 'fixed inset-0 z-50 w-72 -translate-x-full') :
              isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-72'} 
              bg-zinc-900/95 flex flex-col h-full transition-all duration-300 ease-in-out shadow-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Close Button */}
            {isMobile && (
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="absolute top-4 right-4 p-1 text-white/70 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            )}

            {/* Top Action Bar with New Chat button and Collapse button */}
            <div className="flex items-center h-[60px] px-4">
              {/* Desktop Collapse Button (only when sidebar is not collapsed) */}
              {!isMobile && (
                <button
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="p-1.5 mr-2 rounded-full bg-black border border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                  aria-label="Collapse sidebar"
                >
                  <ChevronDown className="h-3.5 w-3.5 rotate-90 text-white/70" />
                </button>
              )}

              {/* New Chat Button */}
              <button
                onClick={() => {
                  createNewConversation();
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className="w-full flex items-center gap-2 text-white bg-white/5 hover:bg-white/10 rounded-md py-2 px-3 h-[36px] text-sm transition-colors cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                <span>New chat</span>
              </button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              <div className="text-xs uppercase text-white/50 font-medium px-2 pb-2">RECENT CHATS</div>
              {conversations.length === 0 ? (
                <p className="text-xs text-white/50 text-center py-2">No saved conversations</p>
              ) : (
                [...conversations].reverse().map(conversation => (
                  <div
                    key={conversation.id}
                    onClick={() => {
                      loadConversation(conversation.id);
                      if (isMobile) setIsSidebarOpen(false);
                    }}
                    className={`p-2 rounded text-sm cursor-pointer flex justify-between items-center group ${activeConversationId === conversation.id
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5'
                      }`}
                  >
                    <div className="flex items-center gap-2 flex-1 truncate">
                      <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70" />
                      <span className="truncate">{conversation.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conversation.id, e);
                      }}
                      className="text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Controls */}
            <div className="p-4 mt-auto">
              {/* Settings Button */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-2 text-white bg-white/5 hover:bg-white/10 rounded-md py-2 px-3 h-[36px] text-sm transition-colors cursor-pointer"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </button>
                {!isMobile && (
                  <div className="bg-white/5 rounded-md py-2 px-3 h-[36px] flex items-center">
                    <span className="text-sm font-medium">{balance}</span>
                    <span className="text-xs text-white/70 ml-1">sats</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Collapse/Expand Button (Desktop only) */}
          {!isMobile && isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="fixed top-[30px] transform -translate-y-1/2 left-4 z-30 bg-black rounded-full p-1.5 shadow-md transition-all duration-300 ease-in-out border border-white/10 hover:bg-white/5 cursor-pointer"
              aria-label="Expand sidebar"
            >
              <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-white/70" />
            </button>
          )}
        </div>
      )}

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-0' : ''}`}>
        {/* Model Selection Bar */}
        <div className="bg-black z-0">
          <div className={`mx-auto w-full max-w-4xl flex items-center ${isMobile ? 'justify-center pl-10' : 'justify-between'} h-[60px] ${isSidebarCollapsed && !isMobile ? 'pl-14' : 'px-4'}`}>
            <div className="relative">
              <button
                onClick={() => isAuthenticated ? setIsModelDrawerOpen(!isModelDrawerOpen) : setIsLoginModalOpen(true)}
                className={`flex items-center gap-2 text-white bg-white/5 hover:bg-white/10 rounded-md ${isMobile ? 'py-2 px-3 h-[36px]' : 'p-3'} text-sm transition-colors cursor-pointer`}
              >
                <span>{selectedModel ? getModelNameWithoutProvider(selectedModel.name) : 'Select Model'}</span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </button>

              {isModelDrawerOpen && isAuthenticated && (
                <div 
                  ref={modelDrawerRef}
                  className="absolute top-full left-0 w-64 mt-1 bg-black border border-white/10 rounded-md shadow-lg max-h-60 overflow-y-auto z-50"
                >
                  {isLoadingModels ? (
                    <div className="flex justify-center items-center py-4">
                      <Loader2 className="h-5 w-5 text-white/50 animate-spin" />
                    </div>
                  ) : (
                    <div className="p-1">
                      {filteredModels.map((model) => (
                        <div
                          key={model.id}
                          className={`p-2 text-sm rounded-md cursor-pointer ${selectedModel?.id === model.id
                            ? 'bg-white/10'
                            : 'hover:bg-white/5'
                            }`}
                          onClick={() => {
                            handleModelChange(model.id);
                            setIsModelDrawerOpen(false);
                          }}
                        >
                          <div className="font-medium">{getModelNameWithoutProvider(model.name)}</div>
                          <div className="text-xs text-white/50">{model.sats_pricing.completion.toFixed(4)} sats</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {!isMobile && (
              <div className="text-xs text-white/50">
                {isAuthenticated ? `${balance} sats available` : (
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="px-4 py-1.5 rounded-full bg-white text-black hover:bg-gray-200 transition-colors"
                  >
                    Sign in
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 md:px-6 py-4 md:py-10">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 pt-24">
                <MessageSquare className="h-16 w-16 mb-6 text-white/20" />
                <p className="text-base text-white/80">Send a message to start chatting</p>
                {selectedModel && (
                  <p className="text-sm text-white/50 mt-2">
                    {getModelNameWithoutProvider(selectedModel.name)}
                  </p>
                )}
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className="mb-8 last:mb-0"
                >
                  {/* User Message */}
                  {message.role === 'user' ? (
                    <div className="flex justify-end mb-6">
                      <div className="max-w-[85%]">
                        {editingMessageIndex === index ? (
                          <div className="flex flex-col w-full">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm text-white focus:outline-none focus:border-white/40"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex justify-end space-x-2 mt-2">
                              <button
                                onClick={cancelEditing}
                                className="text-xs text-gray-300 hover:text-white bg-white/10 px-3 py-1.5 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveInlineEdit}
                                className="text-xs text-white bg-black px-3 py-1.5 rounded hover:bg-black/80"
                              >
                                Save & Send
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="group relative">
                              <div className="bg-gray-700/70 rounded-2xl py-3 px-4 text-white">
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              </div>
                              <div className="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  onClick={() => startEditingMessage(index)}
                                  className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                  aria-label="Edit message"
                                >
                                  <Edit className="w-3 h-3 text-white/70" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : message.role === 'system' ? (
                    /* System Message (for errors) */
                    <div className="flex justify-center mb-6 group">
                      <div className="flex flex-col">
                        <div className="max-w-[85%] bg-red-500/20 border border-red-500/30 rounded-lg py-3 px-4 text-red-200">
                          <div className="flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-300">
                              <path d="M12 9v4M12 21h.01M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <p className="text-sm font-medium">{message.content}</p>
                          </div>
                        </div>
                        <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => {
                              const lastUserMessage = messages.slice(0, index).filter(m => m.role === 'user').pop();
                              if (lastUserMessage) {
                                const newMessages = messages.slice(0, messages.findIndex(m => m === lastUserMessage) + 1);
                                setMessages(newMessages);
                                fetchAIResponse(newMessages);
                              }
                            }}
                            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-black/50 hover:bg-black/70 rounded-md px-3 py-1.5 transition-colors cursor-pointer"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              className="rotate-45"
                            >
                              <path
                                d="M21.168 8A10.003 10.003 0 0 0 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M17 8h4.4a.6.6 0 0 0 .6-.6V3"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* AI Message */
                    <div className="flex flex-col items-start mb-6 group">
                      <div className="max-w-[95%] text-gray-100 py-2 px-0.5">
                        <div className="prose prose-invert max-w-none text-sm">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      </div>

                      {/* Try Again button - only visible on hover */}
                      {message.role === 'assistant' && (
                        <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => {
                              const newMessages = messages.slice(0, index);
                              setMessages(newMessages);
                              fetchAIResponse(newMessages);
                            }}
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-black/50 hover:bg-black/70 rounded-md px-3 py-1.5 transition-colors cursor-pointer"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              className="rotate-45"
                            >
                              <path
                                d="M21.168 8A10.003 10.003 0 0 0 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M17 8h4.4a.6.6 0 0 0 .6-.6V3"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            Try Again
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Streaming response */}
            {streamingContent && (
              <div className="flex flex-col items-start mb-6">
                <div className="max-w-[95%] text-gray-100 py-2 px-0.5">
                  <div className="prose prose-invert max-w-none text-sm">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat Input */}
        <div className="p-3 md:p-4 bg-black">
          <div className="mx-auto w-full max-w-4xl">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={isAuthenticated ? `Ask anything...` : `Sign in to start chatting...`}
                className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none pr-12"
                autoComplete="off"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || (!isAuthenticated && !inputMessage.trim())}
                className="absolute right-2 p-2 rounded-full bg-transparent hover:bg-white/10 disabled:opacity-50 disabled:bg-transparent transition-colors cursor-pointer"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Send className="h-5 w-5 text-white" />
                )}
              </button>
            </div>

            <div className="text-xs text-center text-white/50 mt-2">
              Powered by {selectedModel?.name} • {isAuthenticated ? (
                <span className="text-white/30">{balance} sats available</span>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="text-white/30 hover:text-white/50"
                >
                  Sign in to chat
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && isAuthenticated && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          mintUrl={mintUrl}
          setMintUrl={setMintUrl}
          selectedModel={selectedModel}
          handleModelChange={handleModelChange}
          models={models}
          balance={balance}
          setBalance={setBalance}
          clearConversations={clearConversations}
          logout={logout}
          router={router}
        />
      )}

      {/* Login Modal */}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen w-full bg-black">
        <Loader2 className="h-8 w-8 text-white/50 animate-spin" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
