import React from 'react';
import { TransactionHistory } from '@/types/chat';

interface HistoryTabProps {
  transactionHistory: TransactionHistory[];
  setTransactionHistory: (transactionHistory: TransactionHistory[] | ((prevTransactionHistory: TransactionHistory[]) => TransactionHistory[])) => void;
  onClose: () => void;
}

const HistoryTab: React.FC<HistoryTabProps> = ({
  transactionHistory,
  setTransactionHistory,
  onClose,
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-white/80 mb-2">Transaction History</h3>
      <div className="bg-white/5 border border-white/10 rounded-md p-4">
        {transactionHistory.length === 0 ? (
          <div className="text-xs text-white/50 mb-2">No transactions yet</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {transactionHistory.map((tx, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-md">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    tx.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <div className="text-sm font-medium text-white capitalize">{tx.type}</div>
                    <div className="text-sm text-white">{tx.model}</div>
                    <div className="text-xs text-white/50">
                      {new Date(tx.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-mono text-white">
                    {tx.amount} sats
                  </div>
                  <div className="text-xs text-white/69">
                    Balance: {tx.balance} sats
                  </div>
                </div>
              </div>
            ))}
            {/* Danger Zone */}
            <div className="mt-8 pt-4 border-t border-white/10">
              <h3 className="text-sm font-medium text-red-400 mb-4">Danger Zone</h3>
              <div className="space-y-3">
                <button
                  className="w-full bg-red-500/10 text-red-400 border border-red-500/30 px-3 py-2 rounded-md text-sm hover:bg-red-500/20 transition-colors cursor-pointer"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all transaction history? This cannot be undone.')) {
                      setTransactionHistory([]);
                      localStorage.removeItem('saved_conversations');
                      onClose();
                    }
                  }}
                  type="button"
                >
                  Clear transaction history
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryTab;