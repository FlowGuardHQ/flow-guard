import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface TransactionDetails {
  amount: number; // in BCH
  recipient: string;
  network: 'mainnet' | 'testnet' | 'chipnet';
  description?: string;
}

interface TransactionConfirmModalProps {
  isOpen: boolean;
  transaction: TransactionDetails | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TransactionConfirmModal({
  isOpen,
  transaction,
  onConfirm,
  onCancel,
}: TransactionConfirmModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsConfirming(false);
    }
  }, [isOpen]);

  if (!isOpen || !transaction) return null;

  const handleConfirm = () => {
    setIsConfirming(true);
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-textPrimary/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primarySoft rounded-lg">
              <AlertCircle className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-textPrimary">
              Confirm Transaction
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-textMuted hover:text-textSecondary transition-colors"
            disabled={isConfirming}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-textSecondary">
            Please review the transaction details before confirming:
          </p>

          <div className="bg-whiteAlt rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-textSecondary">Amount:</span>
              <span className="text-lg font-semibold text-textPrimary">
                {transaction.amount.toFixed(8)} BCH
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-textSecondary">To:</span>
              <span className="text-sm font-mono text-textPrimary text-right break-all max-w-[60%]">
                {transaction.recipient}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-textSecondary">Network:</span>
              <span className="text-sm font-semibold text-textPrimary capitalize">
                {transaction.network}
              </span>
            </div>

            {transaction.description && (
              <div className="pt-2 border-t border-border">
                <span className="text-sm font-medium text-textSecondary">Description:</span>
                <p className="text-sm text-textPrimary mt-1">{transaction.description}</p>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              ⚠️ <strong>Warning:</strong> This transaction will be broadcast to the {transaction.network} network immediately after confirmation. Make sure the details are correct.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-border">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-whiteAlt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="flex-1 px-4 py-2.5 bg-[#00E676] hover:bg-[#00C853] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isConfirming ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Confirming...
              </>
            ) : (
              'Confirm Transaction'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

