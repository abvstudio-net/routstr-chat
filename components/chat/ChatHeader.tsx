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
    
    // Balance
    balance,

    // Settings
    setIsSettingsOpen,
    setInitialSettingsTab
  } = useChat();

  return (
    <div className={`fixed top-0 bg-black/95 backdrop-blur-sm z-40 ${
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
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 bg-black rounded-full p-1.5 shadow-md border border-white/10 hover:bg-white/5 cursor-pointer"
          >
            <Menu className="h-4 w-4 text-white/70" />
          </button>
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
          />
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;