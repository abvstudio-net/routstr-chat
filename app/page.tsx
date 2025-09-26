'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/context/AuthProvider';
import { ChatProvider } from '@/context/ChatProvider';
import ChatContainer from '@/components/chat/ChatContainer';
import SettingsModal from '@/components/SettingsModal';
import LoginModal from '@/components/LoginModal';
import TutorialOverlay from '@/components/TutorialOverlay';
import DepositModal from '@/components/DepositModal';
import { QueryTimeoutModal } from '@/components/QueryTimeoutModal';
import { useAuth } from '@/context/AuthProvider';
import { useChat } from '@/context/ChatProvider';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCashuWallet } from '@/hooks/useCashuWallet';

function ChatPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, authChecked, logout } = useAuth();
  const {
    // UI State
    isSettingsOpen,
    setIsSettingsOpen,
    isLoginModalOpen,
    setIsLoginModalOpen,
    isTutorialOpen,
    initialSettingsTab,
    handleTutorialComplete,
    handleTutorialClose,
    
    // API State
    mintUrl,
    setMintUrl,
    baseUrl,
    setBaseUrl,
    selectedModel,
    handleModelChange,
    models,
    
    // Balance and Transaction State
    balance,
    setBalance,
    transactionHistory,
    setTransactionHistory,
    
    // Model State
    configuredModels,
    toggleConfiguredModel,
    setConfiguredModels,
    modelProviderMap,
    setModelProviderFor,
    
    // Chat State
    clearConversations,
    usingNip60,
    setUsingNip60,
    isBalanceLoading,
    conversations,
    loadConversation,
    activeConversationId,
    conversationsLoaded,
  } = useChat();

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const { showQueryTimeoutModal, setShowQueryTimeoutModal, didRelaysTimeout, isLoading: isWalletLoading } = useCashuWallet();
  const pendingUrlSyncRef = useRef(false);
  const searchParamsString = useMemo(() => searchParams.toString(), [searchParams]);
  const chatIdFromUrl = useMemo(() => searchParams.get('chatId'), [searchParams]);

  useEffect(() => {
    if (!isBalanceLoading && balance === 0 && isAuthenticated && !isSettingsOpen && !usingNip60) {
      setIsDepositModalOpen(true);
    } else {
      setIsDepositModalOpen(false);
    }
  }, [balance, isBalanceLoading, isAuthenticated, usingNip60]);

  useEffect(() => {
    if (!activeConversationId) return;
    if (chatIdFromUrl === activeConversationId) return;

    pendingUrlSyncRef.current = true;
    const params = new URLSearchParams(searchParamsString);
    params.set('chatId', activeConversationId);
    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [activeConversationId, chatIdFromUrl, pathname, router, searchParamsString]);

  useEffect(() => {
    if (!chatIdFromUrl) return;
    if (pendingUrlSyncRef.current) return;
    if (!conversationsLoaded) return;

    if (!conversations.length) {
      pendingUrlSyncRef.current = true;
      const params = new URLSearchParams(searchParamsString);
      params.delete('chatId');
      const queryString = params.toString();
      router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
      return;
    }

    if (chatIdFromUrl === activeConversationId) return;

    const matchingConversation = conversations.find(conversation => conversation.id === chatIdFromUrl);
    if (matchingConversation) {
      loadConversation(chatIdFromUrl);
      return;
    }

    const fallbackConversation = conversations[conversations.length - 1];
    if (fallbackConversation) {
      loadConversation(fallbackConversation.id);
    }
  }, [
    chatIdFromUrl,
    conversations,
    conversationsLoaded,
    activeConversationId,
    loadConversation,
    router,
    pathname,
    searchParamsString
  ]);

  useEffect(() => {
    if (!pendingUrlSyncRef.current) return;

    if (activeConversationId && chatIdFromUrl === activeConversationId) {
      pendingUrlSyncRef.current = false;
      return;
    }

    if (!activeConversationId && !chatIdFromUrl) {
      pendingUrlSyncRef.current = false;
    }
  }, [chatIdFromUrl, activeConversationId]);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-dvh w-full bg-[#212121]">
        <Loader2 className="h-8 w-8 text-white/50 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full bg-[#212121] text-white overflow-hidden">
      <ChatContainer />

      {/* Modals */}
      {isSettingsOpen && isAuthenticated && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          initialActiveTab={initialSettingsTab}
          mintUrl={mintUrl}
          setMintUrl={setMintUrl}
          baseUrl={baseUrl}
          setBaseUrl={setBaseUrl}
          selectedModel={selectedModel}
          handleModelChange={handleModelChange}
          models={models}
          balance={balance}
          setBalance={setBalance}
          clearConversations={clearConversations}
          logout={logout}
          router={router}
          transactionHistory={transactionHistory}
          setTransactionHistory={setTransactionHistory}
          configuredModels={configuredModels}
          toggleConfiguredModel={toggleConfiguredModel}
          setConfiguredModels={setConfiguredModels}
          modelProviderMap={modelProviderMap}
          setModelProviderFor={setModelProviderFor}
          usingNip60={usingNip60}
          setUsingNip60={(value) => {
            setUsingNip60(value);
          }}
        />
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={() => setIsLoginModalOpen(false)}
      />

      {false && (<TutorialOverlay
        isOpen={isTutorialOpen}
        onComplete={handleTutorialComplete}
        onClose={handleTutorialClose}
      />)}

      {/* Deposit Modal */}
      {isDepositModalOpen && (
        <DepositModal
          isOpen={isDepositModalOpen}
          onClose={() => setIsDepositModalOpen(false)}
          mintUrl={mintUrl}
          balance={balance}
          setBalance={setBalance}
          usingNip60={usingNip60}
        />
      )}

      <QueryTimeoutModal
        isOpen={showQueryTimeoutModal || (didRelaysTimeout && !isWalletLoading)}
        onClose={() => setShowQueryTimeoutModal(false)}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-dvh w-full bg-[#212121]">
        <Loader2 className="h-8 w-8 text-white/50 animate-spin" />
      </div>
    }>
      <AuthProvider>
        <ChatProvider>
          <ChatPageContent />
        </ChatProvider>
      </AuthProvider>
    </Suspense>
  );
}
