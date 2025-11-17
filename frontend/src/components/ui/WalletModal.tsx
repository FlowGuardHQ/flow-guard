/**
 * Wallet Selection Modal
 * Allows users to choose between Selene and mainnet.cash wallets
 */

import { useState } from 'react';
import { WalletType } from '../../types/wallet';
import { Wallet, X, ExternalLink, Moon, Coins } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WalletOption {
  type: WalletType;
  name: string;
  description: string;
  Icon: LucideIcon;
  installUrl?: string;
}

const walletOptions: WalletOption[] = [
  {
    type: WalletType.SELENE,
    name: 'Selene Wallet',
    description: 'Browser extension wallet for BCH',
    Icon: Moon,
    installUrl: 'https://selene.cash',
  },
  {
    type: WalletType.MAINNET,
    name: 'mainnet.cash',
    description: 'In-browser BCH wallet (creates new wallet)',
    Icon: Coins,
  },
];

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWallet: (walletType: WalletType) => Promise<void>;
  isConnecting: boolean;
  error: string | null;
}

export function WalletModal({
  isOpen,
  onClose,
  onSelectWallet,
  isConnecting,
  error,
}: WalletModalProps) {
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (walletType: WalletType) => {
    setSelectedWallet(walletType);
    try {
      await onSelectWallet(walletType);
      onClose(); // Close modal on success
    } catch (err) {
      // Error is handled by parent component
      setSelectedWallet(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#2d2d2d] rounded-2xl shadow-2xl max-w-md w-full my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#b2ac88]/10 rounded-lg">
              <Wallet className="w-5 h-5 text-[#b2ac88]" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Connect Wallet
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            disabled={isConnecting}
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose a wallet to connect to FlowGuard
          </p>

          {/* Wallet Options */}
          <div className="space-y-3">
            {walletOptions.map((wallet) => {
              const WalletIcon = wallet.Icon;
              return (
                <button
                  key={wallet.type}
                  onClick={() => handleConnect(wallet.type)}
                  disabled={isConnecting}
                  className={`w-full p-4 border rounded-xl transition-all hover:border-[#b2ac88] hover:shadow-md group bg-white dark:bg-[#1a1a1a] ${
                    isConnecting && selectedWallet === wallet.type
                      ? 'border-[#b2ac88] bg-[#b2ac88]/5 dark:bg-[#b2ac88]/10'
                      : 'border-gray-200 dark:border-gray-700'
                  } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#b2ac88]/10 dark:bg-[#b2ac88]/20 rounded-lg">
                        <WalletIcon className="w-6 h-6 text-[#b2ac88] dark:text-[#b2ac88]" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-[#b2ac88] transition-colors">
                          {wallet.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {wallet.description}
                        </p>
                      </div>
                    </div>

                    {isConnecting && selectedWallet === wallet.type ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#b2ac88] border-t-transparent" />
                    ) : wallet.installUrl ? (
                      <a
                        href={wallet.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-[#b2ac88] dark:hover:text-[#b2ac88]" />
                      </a>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">Note:</strong> By connecting your wallet, you agree to FlowGuard's
              terms. Your wallet remains in your custody at all times.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
