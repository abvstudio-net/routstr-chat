import React from 'react';
import { CashuWallet, MintQuoteResponse } from '@cashu/cashu-ts';
import { getBalanceFromStoredProofs } from '@/utils/cashuUtils';

interface WalletTabProps {
  balance: number;
  error: string;
  successMessage: string;
  mintAmount: string;
  setMintAmount: (amount: string) => void;
  createMintQuote: () => Promise<void>;
  isMinting: boolean;
  mintInvoice: string;
  setShowInvoiceModal: (show: boolean) => void;
  isAutoChecking: boolean;
  countdown: number;
  sendAmount: string;
  setSendAmount: (amount: string) => void;
  generateSendToken: () => Promise<void>;
  isGeneratingSendToken: boolean;
  generatedToken: string;
  tokenToImport: string;
  setTokenToImport: (token: string) => void;
  importToken: () => Promise<void>;
  isImporting: boolean;
}

const WalletTab: React.FC<WalletTabProps> = ({
  balance,
  error,
  successMessage,
  mintAmount,
  setMintAmount,
  createMintQuote,
  isMinting,
  mintInvoice,
  setShowInvoiceModal,
  isAutoChecking,
  countdown,
  sendAmount,
  setSendAmount,
  generateSendToken,
  isGeneratingSendToken,
  generatedToken,
  tokenToImport,
  setTokenToImport,
  importToken,
  isImporting,
}) => {
  return (
    <div className="space-y-6">
      {/* Balance Display */}
      <div className="bg-white/5 border border-white/10 rounded-md p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/70">Available Balance</span>
          <div className="flex flex-col items-end">
            <span className="text-lg font-semibold text-white">{balance} sats</span>
            <span className="text-sm text-white/69">({Number(balance - getBalanceFromStoredProofs()).toFixed(3)}+{getBalanceFromStoredProofs()}) sats</span>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-3 rounded-md text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-200 p-3 rounded-md text-sm">
          {successMessage}
        </div>
      )}

      {/* Mint Tokens Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white/80">Mint New Tokens</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={mintAmount}
            onChange={(e) => setMintAmount(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            placeholder="Amount in sats"
          />
          <button
            onClick={createMintQuote}
            disabled={isMinting || !mintAmount}
            className="bg-white/10 border border-white/10 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-50 cursor-pointer"
            type="button"
          >
            {isMinting ? 'Generating...' : 'Generate Invoice'}
          </button>
        </div>

        {mintInvoice && (
          <div className="bg-white/5 border border-white/10 rounded-md p-4">
            <div className="mb-2 flex justify-between items-center">
              <span className="text-sm text-white/70">Lightning Invoice</span>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="text-xs text-blue-300 hover:text-blue-200 cursor-pointer"
                type="button"
              >
                Show QR Code
              </button>
            </div>
            {isAutoChecking && (
              <div className="mb-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md p-2 flex items-center justify-between">
                <span className="text-xs text-yellow-200/80">After payment, tokens will be automatically minted</span>
                <span className="text-xs text-yellow-200/80 flex items-center">
                  {countdown}s
                  <svg className="ml-2 w-3 h-3 animate-spin" viewBox="0 0 24 24">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                  </svg>
                </span>
              </div>
            )}
            <div className="font-mono text-xs break-all text-white/70">
              {mintInvoice}
            </div>
          </div>
        )}
      </div>

      {/* Send Tokens Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white/80">Send Tokens</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            placeholder="Amount in sats"
          />
          <button
            onClick={generateSendToken}
            disabled={isGeneratingSendToken || !sendAmount || parseInt(sendAmount) > balance}
            className="bg-white/10 border border-white/10 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-50 cursor-pointer"
            type="button"
          >
            {isGeneratingSendToken ? 'Generating...' : 'Generate Token'}
          </button>
        </div>

        {generatedToken && (
          <div className="bg-white/5 border border-white/10 rounded-md p-4">
            <div className="mb-2 flex justify-between items-center">
              <span className="text-sm text-white/70">Generated Token</span>
              <button
                onClick={() => {
                  try {
                    void navigator.clipboard.writeText(generatedToken);
                    // setSuccessMessage('Token copied to clipboard!'); // This will be handled by parent
                    // setTimeout(() => setSuccessMessage(''), 3000);
                  } catch {
                    // setError('Failed to copy token to clipboard'); // This will be handled by parent
                  }
                }}
                className="text-xs text-blue-300 hover:text-blue-200 cursor-pointer"
                type="button"
              >
                Copy Token
              </button>
            </div>
            <div className="font-mono text-xs break-all text-white/70">
              {generatedToken}
            </div>
          </div>
        )}
      </div>

      {/* Import Tokens Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white/80">Import Tokens</h3>
        <div className="space-y-2">
          <textarea
            value={tokenToImport}
            onChange={(e) => setTokenToImport(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white h-24 focus:border-white/30 focus:outline-none"
            placeholder="Paste your Cashu token here..."
          />
          <button
            onClick={importToken}
            disabled={isImporting || !tokenToImport.trim()}
            className="w-full bg-white/10 border border-white/10 text-white py-2 rounded-md text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-50 cursor-pointer"
            type="button"
          >
            {isImporting ? 'Importing...' : 'Import Token'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletTab;