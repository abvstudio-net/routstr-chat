import React from 'react';
import { X } from 'lucide-react';

interface LowBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LowBalanceModal: React.FC<LowBalanceModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-black rounded-lg max-w-md w-full m-4 border border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Low Balance Warning</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-white/80 text-sm">
            Your current balance is too low to create a spendable token (minimum 12 sats required).
            Please add more funds to your wallet to continue.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-white/10 border border-white/10 text-white rounded-md text-sm font-medium hover:bg-white/15 transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default LowBalanceModal;