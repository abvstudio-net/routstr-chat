'use client';

import React from 'react';
import { useChat } from '@/context/ChatProvider';
import { useAuth } from '@/context/AuthProvider';

/**
 * User balance and authentication status component
 * Handles balance formatting and display, loading states,
 * sign-in prompt for unauthenticated users, and balance refresh handling
 */
interface BalanceDisplayProps {
  setIsSettingsOpen: (isOpen: boolean) => void;
  setInitialSettingsTab: (tab: 'settings' | 'wallet' | 'history' | 'api-keys') => void;
}

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({ setIsSettingsOpen, setInitialSettingsTab }) => {
  const { isAuthenticated } = useAuth();
  const { balance, isBalanceLoading, setIsLoginModalOpen } = useChat();

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => setIsLoginModalOpen(true)}
        className="px-3 py-1.5 rounded-full bg-white text-black hover:bg-gray-200 transition-colors text-xs"
      >
        Sign in
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        setIsSettingsOpen(true);
        setInitialSettingsTab('wallet');
      }}
      className="px-3 py-1.5 rounded-md bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-xs flex items-center justify-center border border-white/10"
    >
      {isBalanceLoading ? 'loading' : `${balance} sats`}
    </button>
  );
};

export default BalanceDisplay;