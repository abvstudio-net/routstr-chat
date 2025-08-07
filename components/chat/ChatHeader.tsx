'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { useChat } from '@/context/ChatProvider';
import { useAuth } from '@/context/AuthProvider';
import ModelSelector from './ModelSelector';
import BalanceDisplay from '../ui/BalanceDisplay';

/**
 * Top header with model selector and controls
 * Handles model selector integration, balance display,
 * mobile menu button, and header layout and styling
 */
const ChatHeader: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const {
    // Model State
    selectedModel,
    isModelDrawerOpen,
    setIsModelDrawerOpen,
    isLoadingModels,
    models: filteredModels,
    handleModelChange,
    favoriteModels,
    toggleFavoriteModel,
    
    // UI State
    isMobile,
    isSidebarCollapsed,
    setIsSidebarOpen,
    setIsLoginModalOpen,
    createNewConversationHandler,
    
    // Balance
    balance,
    usingNip60,

    // Settings
    setIsSettingsOpen,
    setInitialSettingsTab
  } = useChat();

  return (
    <div className={`fixed top-0 bg-black/95 backdrop-blur-sm z-40 transition-all duration-300 ease-in-out ${
      isMobile || !isAuthenticated ? 'left-0 right-0' : isSidebarCollapsed ? 'left-0 right-0' : 'left-72 right-0'
    }`}>
      <div className="flex items-center justify-center h-[60px] px-4 relative">
        {/* Mobile Menu Button */}
        {isMobile && !isAuthenticated && (
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="absolute left-4 bg-black rounded-full p-1.5 shadow-md border border-white/10 hover:bg-white/5 cursor-pointer"
          >
            <Menu className="h-4 w-4 text-white/70" />
          </button>
        )}
        {isMobile && isAuthenticated && (
          <div className="absolute left-4 flex gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="bg-black rounded-full p-1.5 shadow-md border border-white/10 hover:bg-white/5 cursor-pointer"
            >
              <Menu className="h-4 w-4 text-white/70" />
            </button>
            <button
              onClick={() => createNewConversationHandler()}
              className="bg-black rounded-full p-1.5 shadow-md border border-white/10 hover:bg-white/5 cursor-pointer"
              aria-label="New chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </button>
          </div>
        )}

        {/* Model Selector */}
        <ModelSelector
          selectedModel={selectedModel}
          isModelDrawerOpen={isModelDrawerOpen}
          setIsModelDrawerOpen={setIsModelDrawerOpen}
          isAuthenticated={isAuthenticated}
          setIsLoginModalOpen={setIsLoginModalOpen}
          isLoadingModels={isLoadingModels}
          filteredModels={filteredModels}
          handleModelChange={handleModelChange}
          balance={balance}
          favoriteModels={favoriteModels}
          toggleFavoriteModel={toggleFavoriteModel}
        />

        {/* Balance Display */}
        <div className="absolute right-4">
          <BalanceDisplay
            setIsSettingsOpen={setIsSettingsOpen}
            setInitialSettingsTab={setInitialSettingsTab}
            usingNip60={usingNip60}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;