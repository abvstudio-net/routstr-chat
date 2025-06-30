'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { useChat } from '@/context/ChatProvider';
import { useAuth } from '@/context/AuthProvider';
import ChatHeader from './ChatHeader';
import MainChatArea from './MainChatArea';
import Sidebar from './Sidebar';

/**
 * Main layout container and orchestration component
 * Handles overall layout structure, responsive design logic,
 * component composition, and event handling coordination
 */
const ChatContainer: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const {
    // UI State
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobile,
    setIsSettingsOpen,
    setInitialSettingsTab,
    
    // Conversation State
    conversations,
    activeConversationId,
    createNewConversationHandler,
    loadConversation,
    deleteConversation,
    
    // Balance
    balance
  } = useChat();

  return (
    <div className="flex h-dvh w-full bg-black text-white overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <div
          className={`fixed inset-0 bg-black/70 z-40 transition-opacity duration-300 ${
            isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isAuthenticated={isAuthenticated}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        isMobile={isMobile}
        conversations={conversations}
        activeConversationId={activeConversationId}
        createNewConversation={createNewConversationHandler}
        loadConversation={loadConversation}
        deleteConversation={deleteConversation}
        setIsSettingsOpen={setIsSettingsOpen}
        setInitialSettingsTab={setInitialSettingsTab}
        balance={balance}
      />

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? 'ml-0' : ''
      }`}>
        {/* Fixed Header */}
        <ChatHeader />

        {/* Main Chat Content */}
        <MainChatArea />
      </div>
    </div>
  );
};

export default ChatContainer;