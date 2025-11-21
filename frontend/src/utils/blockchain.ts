/**
 * Blockchain transaction utilities
 * Handles wallet signing and transaction broadcasting
 */

import { broadcastTransaction } from './api';

export interface SignTransactionRequest {
  txHex: string;
  requiresSignatures: string[]; // Public keys that need to sign
}

export interface SignTransactionResult {
  signedTxHex: string;
  txid: string;
}

/**
 * Sign a transaction using the connected wallet
 * @param wallet The wallet instance (Paytaca/Badger/mainnet.cash)
 * @param txHex The transaction hex to sign
 * @returns Signed transaction hex
 */
export async function signTransaction(
  wallet: any,
  txHex: string
): Promise<string> {
  try {
    // Check if wallet has signTransaction method
    if (wallet && typeof wallet.signTransaction === 'function') {
      const signedTx = await wallet.signTransaction(txHex);
      return signedTx;
    }

    // Fallback: Try different wallet APIs
    if (wallet && typeof wallet.sign === 'function') {
      const signedTx = await wallet.sign(txHex);
      return signedTx;
    }

    throw new Error('Wallet does not support transaction signing');
  } catch (error: any) {
    console.error('Failed to sign transaction:', error);
    throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Sign and broadcast a transaction
 * @param wallet The wallet instance
 * @param txHex The transaction hex to sign
 * @returns Transaction ID after successful broadcast
 */
export async function signAndBroadcast(
  wallet: any,
  txHex: string
): Promise<string> {
  // Step 1: Sign the transaction with wallet
  const signedTxHex = await signTransaction(wallet, txHex);

  // Step 2: Broadcast the signed transaction to the network
  const result = await broadcastTransaction(signedTxHex);

  return result.txid;
}

/**
 * Create, sign, and broadcast an on-chain proposal
 * @param wallet The wallet instance
 * @param proposalId The proposal ID
 * @param userPublicKey The user's public key (hex)
 * @returns Transaction ID
 */
export async function createProposalOnChain(
  wallet: any,
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
 * @param wallet The wallet instance
 * @param proposalId The proposal ID
 * @param userPublicKey The user's public key (hex)
 * @returns Transaction ID
 */
export async function approveProposalOnChain(
  wallet: any,
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
 * @param wallet The wallet instance
 * @param proposalId The proposal ID
 * @returns Transaction ID
 */
export async function executePayoutOnChain(
  wallet: any,
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
 * @param wallet The wallet instance
 * @param vaultId The vault ID
 * @param cycleNumber The cycle number to unlock
 * @param userPublicKey The user's public key (hex)
 * @returns Transaction ID
 */
export async function unlockCycleOnChain(
  wallet: any,
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
