import { useState, useCallback } from 'react';
import { TransactionConfirmModal } from '../components/ui/TransactionConfirmModal';

interface TransactionDetails {
  amount: number; // in BCH
  recipient: string;
  network: 'mainnet' | 'testnet' | 'chipnet';
  description?: string;
}

export function useTransactionConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const confirmTransaction = useCallback(
    (details: TransactionDetails): Promise<boolean> => {
      return new Promise((resolve) => {
        setTransaction(details);
        setResolvePromise(() => resolve);
        setIsOpen(true);
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(true);
      setResolvePromise(null);
      setIsOpen(false);
      setTransaction(null);
    }
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
      setIsOpen(false);
      setTransaction(null);
    }
  }, [resolvePromise]);

  const Modal = () => (
    <TransactionConfirmModal
      isOpen={isOpen}
      transaction={transaction}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return {
    confirmTransaction,
    TransactionConfirmModal: Modal,
  };
}

