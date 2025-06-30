'use client';

import React from 'react';
import { useChat } from '@/context/ChatProvider';
import { useAuth } from '@/context/AuthProvider';

/**
 * User balance and authentication status component
 * Handles balance formatting and display, loading states,
 * sign-in prompt for unauthenticated users, and balance refresh handling
 */
const BalanceDisplay: React.FC = () => {
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
    <div className="text-xs text-white/50">
      {isBalanceLoading ? 'loading' : `${balance} sats`}
    </div>
  );
};

export default BalanceDisplay;