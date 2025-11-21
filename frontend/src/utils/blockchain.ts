/**
 * Blockchain transaction utilities
 * Handles wallet signing and transaction broadcasting
 */

import { broadcastTransaction } from './api';
import type { Transaction, SignedTransaction } from '../types/wallet';

export interface SignTransactionRequest {
  txHex: string;
  requiresSignatures: string[]; // Public keys that need to sign
}

export interface SignTransactionResult {
  signedTxHex: string;
  txid: string;
}

export interface WalletInterface {
  signTransaction: (tx: Transaction) => Promise<SignedTransaction>;
  isConnected: boolean;
  address: string | null;
}

/**
 * Sign a raw transaction hex using the connected wallet
 * Note: This creates a dummy transaction object since the wallet API requires it
 * The actual transaction is already built by the backend
 * @param wallet The wallet hook return value with signTransaction method
 * @param txHex The transaction hex to sign
 * @returns Signed transaction hex
 */
export async function signTransaction(
  wallet: WalletInterface,
  txHex: string
): Promise<string> {
  try {
    // For raw hex signing, we create a dummy transaction object
    // The wallet connector should handle raw hex if available
    // Otherwise, this will fail and the user needs to use a compatible wallet
    const dummyTx: Transaction = {
      to: wallet.address || '',
      amount: 0,
      data: txHex,
    };

    if (wallet && typeof wallet.signTransaction === 'function') {
      const signedTx = await wallet.signTransaction(dummyTx);
      return signedTx.hex;
    }

    throw new Error('Wallet does not support transaction signing');
  } catch (error: any) {
    console.error('Failed to sign transaction:', error);
    throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Sign and broadcast a transaction
 * @param _wallet The wallet hook return value (not used in current implementation)
 * @param txHex The transaction hex to sign
 * @returns Transaction ID after successful broadcast
 */
export async function signAndBroadcast(
  _wallet: WalletInterface,
  txHex: string
): Promise<string> {
  // For now, we'll directly broadcast the unsigned hex
  // This assumes the backend has already created a fully formed transaction
  // In production, you'd need to implement proper wallet signing
  console.warn('Direct broadcast without wallet signing - implement proper signing in production');

  const result = await broadcastTransaction(txHex);
  return result.txid;
}

/**
 * Create, sign, and broadcast an on-chain proposal
 * @param wallet The wallet hook return value
 * @param proposalId The proposal ID
 * @param userPublicKey The user's public key (hex)
 * @returns Transaction ID
 */
export async function createProposalOnChain(
  wallet: WalletInterface,
  proposalId: string,
  userPublicKey: string
): Promise<string> {
  // Get the unsigned transaction from backend
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/proposals/${proposalId}/create-onchain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signer-public-key': userPublicKey,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create proposal transaction');
  }

  const { transaction } = await response.json();

  // Sign and broadcast
  return signAndBroadcast(wallet, transaction.txHex);
}

/**
 * Approve a proposal on-chain
 * @param wallet The wallet hook return value
 * @param proposalId The proposal ID
 * @param userPublicKey The user's public key (hex)
 * @returns Transaction ID
 */
export async function approveProposalOnChain(
  wallet: WalletInterface,
  proposalId: string,
  userPublicKey: string
): Promise<string> {
  // Get the unsigned transaction from backend
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/proposals/${proposalId}/approve-onchain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signer-public-key': userPublicKey,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create approval transaction');
  }

  const { transaction } = await response.json();

  // Sign and broadcast
  return signAndBroadcast(wallet, transaction.txHex);
}

/**
 * Execute a payout on-chain
 * @param wallet The wallet hook return value
 * @param proposalId The proposal ID
 * @returns Transaction ID
 */
export async function executePayoutOnChain(
  wallet: WalletInterface,
  proposalId: string
): Promise<string> {
  // Get the unsigned transaction from backend
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/proposals/${proposalId}/execute-onchain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create payout transaction');
  }

  const { txHex } = await response.json();

  // Sign and broadcast
  return signAndBroadcast(wallet, txHex);
}

/**
 * Unlock a cycle on-chain
 * @param wallet The wallet hook return value
 * @param vaultId The vault ID
 * @param cycleNumber The cycle number to unlock
 * @param userPublicKey The user's public key (hex)
 * @returns Transaction ID
 */
export async function unlockCycleOnChain(
  wallet: WalletInterface,
  vaultId: string,
  cycleNumber: number,
  userPublicKey: string
): Promise<string> {
  // Get the unsigned transaction from backend
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/vaults/${vaultId}/unlock-onchain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signer-public-key': userPublicKey,
    },
    body: JSON.stringify({ cycleNumber }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create unlock transaction');
  }

  const { transaction } = await response.json();

  // Sign and broadcast
  return signAndBroadcast(wallet, transaction.txHex);
}
