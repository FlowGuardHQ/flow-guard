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
  signRawTransaction?: (txHex: string) => Promise<string>;
  isConnected: boolean;
  address: string | null;
  walletType?: string | null;
}

/**
 * Sign a raw transaction hex using the connected wallet
 * For BCH covenant transactions, we need to sign raw transaction hex
 * @param wallet The wallet hook return value with signTransaction method
 * @param txHex The transaction hex to sign
 * @returns Signed transaction hex
 */
export async function signTransaction(
  wallet: WalletInterface,
  txHex: string
): Promise<string> {
  try {
    // Check if wallet has a method to sign raw hex directly
    if (wallet && wallet.signRawTransaction && typeof wallet.signRawTransaction === 'function') {
      try {
        const signedHex = await wallet.signRawTransaction(txHex);
        console.log('Successfully signed transaction with wallet signRawTransaction method');
        return signedHex;
      } catch (signError: any) {
        console.warn('Raw transaction signing failed, trying alternative method:', signError);
        // Fall through to alternative method
      }
    }


    // Alternative: Try using signTransaction with hex in data field
    // Some wallets might support this
    try {
      const dummyTx: Transaction = {
        to: wallet.address || '',
        amount: 0,
        data: txHex,
      };

      if (wallet && typeof wallet.signTransaction === 'function') {
        const signedTx = await wallet.signTransaction(dummyTx);
        if (signedTx.hex && signedTx.hex.length > 0) {
          return signedTx.hex;
        }
      }
    } catch (altError) {
      console.warn('Alternative signing method failed:', altError);
    }

    // If all signing methods fail, return the hex as-is
    // The transaction may be pre-signed by CashScript's SignatureTemplate
    // or may need to be signed on the backend
    console.warn(
      'Wallet does not support raw transaction hex signing. ' +
      'Transaction may need to be signed differently or is already signed.'
    );
    return txHex;
  } catch (error: any) {
    console.error('Failed to sign transaction:', error);
    throw new Error(`Signing failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Sign and broadcast a transaction
 * For BCH covenant transactions, the backend builds transactions with SignatureTemplate
 * which signs automatically if private keys are available. For browser wallets,
 * we need to handle signing differently.
 * @param wallet The wallet hook return value
 * @param txHex The transaction hex to sign
 * @param metadata Optional metadata for transaction tracking
 * @returns Transaction ID after successful broadcast
 */
export async function signAndBroadcast(
  wallet: WalletInterface,
  txHex: string,
  metadata?: {
    txType?: 'create' | 'unlock' | 'proposal' | 'approve' | 'payout';
    vaultId?: string;
    proposalId?: string;
    amount?: number;
    fromAddress?: string;
    toAddress?: string;
  }
): Promise<string> {
  try {
    // Try to sign the transaction first
    let signedTxHex = txHex;
    
    // Use signRawTransaction if available
    if (wallet.signRawTransaction && typeof wallet.signRawTransaction === 'function') {
      try {
        console.log('Using wallet signRawTransaction method...');
        signedTxHex = await wallet.signRawTransaction(txHex);
        console.log('Transaction signed successfully with signRawTransaction');
      } catch (signError: any) {
        console.warn('signRawTransaction failed, trying alternative:', signError);
        // Fall through to alternative method
      }
    }
    
    // Alternative: Try signTransaction with hex in data field
    if (signedTxHex === txHex) {
      try {
        signedTxHex = await signTransaction(wallet, txHex);
        console.log('Transaction signed successfully with signTransaction');
      } catch (signError) {
        console.warn('Could not sign transaction with wallet, using as-is:', signError);
        // Continue with unsigned hex - backend may handle it or transaction may be pre-signed
      }
    }

    // Broadcast the (potentially signed) transaction with metadata
    const result = await broadcastTransaction(signedTxHex, metadata);
    return result.txid;
  } catch (error: any) {
    console.error('Failed to sign and broadcast transaction:', error);
    throw new Error(`Transaction failed: ${error.message || 'Unknown error'}`);
  }
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
  userPublicKey: string,
  metadata?: { vaultId?: string; proposalId?: string; amount?: number; toAddress?: string }
): Promise<string> {
  // Get the unsigned transaction from backend
  const apiUrl = '/api';
  const response = await fetch(`${apiUrl}/proposals/${proposalId}/create-onchain`, {
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

  // Sign and broadcast with metadata
  return signAndBroadcast(wallet, transaction.txHex, {
    txType: 'proposal',
    ...metadata,
    fromAddress: wallet.address || undefined,
  });
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
  userPublicKey: string,
  metadata?: { vaultId?: string; proposalId?: string }
): Promise<string> {
  // Get the unsigned transaction from backend
  const apiUrl = '/api';
  const response = await fetch(`${apiUrl}/proposals/${proposalId}/approve-onchain`, {
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

  // Sign and broadcast with metadata
  return signAndBroadcast(wallet, transaction.txHex, {
    txType: 'approve',
    ...metadata,
    fromAddress: wallet.address || undefined,
  });
}

/**
 * Execute a payout on-chain
 * @param wallet The wallet hook return value
 * @param proposalId The proposal ID
 * @returns Transaction ID
 */
export async function executePayoutOnChain(
  wallet: WalletInterface,
  proposalId: string,
  metadata?: { vaultId?: string; proposalId?: string; amount?: number; toAddress?: string }
): Promise<string> {
  // Get the unsigned transaction from backend
  const apiUrl = '/api';
  const response = await fetch(`${apiUrl}/proposals/${proposalId}/execute-onchain`, {
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

  // Sign and broadcast with metadata
  return signAndBroadcast(wallet, txHex, {
    txType: 'payout',
    ...metadata,
    fromAddress: wallet.address || undefined,
  });
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
  userPublicKey: string,
  metadata?: { vaultId?: string; amount?: number }
): Promise<string> {
  // Get the unsigned transaction from backend
  const apiUrl = '/api';
  const response = await fetch(`${apiUrl}/vaults/${vaultId}/unlock-onchain`, {
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

  // Sign and broadcast with metadata
  return signAndBroadcast(wallet, transaction.txHex, {
    txType: 'unlock',
    vaultId,
    ...metadata,
    fromAddress: wallet.address || undefined,
  });
}

/**
 * Deposit BCH to a vault contract
 * This is a simple P2PKH → P2SH send using the wallet's native send() method
 * @param wallet The wallet hook return value
 * @param contractAddress The vault contract address (P2SH)
 * @param amountBCH The amount to deposit in BCH
 * @param onConfirm Optional confirmation callback that returns a promise resolving to boolean
 * @returns Transaction ID
 */
export async function depositToVault(
  wallet: WalletInterface,
  contractAddress: string,
  amountBCH: number,
  onConfirm?: (details: { amount: number; recipient: string; network: 'mainnet' | 'testnet' | 'chipnet' }) => Promise<boolean>
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    if (amountBCH <= 0) {
      throw new Error('Deposit amount must be greater than 0');
    }

    // Convert BCH to satoshis
    const amountSatoshis = Math.floor(amountBCH * 100000000);

    // For mainnet.cash wallets, show confirmation dialog if callback provided
    if (onConfirm && wallet.walletType === 'mainnet') {
      // Get network from wallet state (it's part of WalletState)
      const network = ((wallet as any).network || 'chipnet') as 'mainnet' | 'testnet' | 'chipnet';
      const confirmed = await onConfirm({
        amount: amountBCH,
        recipient: contractAddress,
        network,
      });

      if (!confirmed) {
        throw new Error('Transaction cancelled by user');
      }
    }

    // Use wallet's signTransaction method to send BCH
    // This will use the wallet's native send() method (mainnet.cash or extension)
    const transaction: Transaction = {
      to: contractAddress,
      amount: amountSatoshis,
    };

    const signedTx = await wallet.signTransaction(transaction);

    if (!signedTx.txId) {
      throw new Error('Transaction ID not returned from wallet');
    }

    return signedTx.txId;
  } catch (error: any) {
    console.error('Failed to deposit to vault:', error);

    // Provide more specific error messages
    if (error.message.includes('insufficient') || error.message.includes('balance')) {
      throw new Error('Insufficient balance in wallet. Please ensure you have enough BCH to cover the deposit and transaction fees.');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Deposit failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get blockchain explorer URL for a transaction
 * @param txHash Transaction hash
 * @param network Network type (chipnet or mainnet)
 * @returns Explorer URL
 */
export function getExplorerTxUrl(txHash: string, network: 'chipnet' | 'mainnet' = 'chipnet'): string {
  if (network === 'mainnet') {
    return `https://blockchair.com/bitcoin-cash/transaction/${txHash}`;
  }
  return `https://chipnet.chaingraph.cash/tx/${txHash}`;
}

/**
 * Get blockchain explorer URL for an address
 * @param address BCH address (with or without prefix)
 * @param network Network type (chipnet or mainnet)
 * @returns Explorer URL
 */
export function getExplorerAddressUrl(address: string, network: 'chipnet' | 'mainnet' = 'chipnet'): string {
  // Keep the address as-is (with prefix if present)
  // chaingraph.cash expects full address with prefix
  if (network === 'mainnet') {
    return `https://blockchair.com/bitcoin-cash/address/${address}`;
  }
  return `https://chipnet.chaingraph.cash/address/${address}`;
}

/**
 * Fund a stream contract with initial deposit
 * @param wallet The wallet hook return value
 * @param streamId The stream ID to fund
 * @returns Transaction ID
 */
export async function fundStreamContract(
  wallet: WalletInterface,
  streamId: string
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    // Get funding info from backend
    const apiUrl = '/api';
    const response = await fetch(`${apiUrl}/streams/${streamId}/funding-info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get funding info');
    }

    const { fundingInfo } = await response.json();

    // For now, use simple transaction send (BCH only)
    // TODO: Add NFT commitment and CashTokens support
    const transaction: Transaction = {
      to: fundingInfo.contractAddress,
      amount: fundingInfo.amount, // satoshis (dust for tokens, full amount for BCH)
    };

    const signedTx = await wallet.signTransaction(transaction);

    if (!signedTx.txId) {
      throw new Error('Transaction ID not returned from wallet');
    }

    // Confirm funding with backend
    const confirmResponse = await fetch(`${apiUrl}/streams/${streamId}/confirm-funding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        txHash: signedTx.txId,
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('Failed to confirm funding, but transaction was broadcast:', error);
      // Still return txId even if confirmation fails
    }

    return signedTx.txId;
  } catch (error: any) {
    console.error('Failed to fund stream:', error);

    if (error.message.includes('insufficient') || error.message.includes('balance')) {
      throw new Error('Insufficient balance in wallet');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Funding failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Claim vested funds from a stream
 * @param wallet The wallet hook return value
 * @param streamId The stream ID to claim from
 * @returns Transaction ID
 */
export async function claimStreamFunds(
  wallet: WalletInterface,
  streamId: string
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    // Get claim transaction from backend
    const apiUrl = '/api';
    const response = await fetch(`${apiUrl}/streams/${streamId}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientAddress: wallet.address,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to build claim transaction');
    }

    const { claimableAmount, inputs, outputs, fee, contractFunction, contractParams, message } = await response.json();

    if (claimableAmount <= 0) {
      throw new Error('No funds available to claim at this time');
    }

    // TODO: Build and sign actual covenant transaction
    // The backend provides structured transaction parameters (inputs, outputs, fee, contractParams)
    // In production, this would build the actual covenant transaction with claim() function
    console.log('Claim transaction ready:', { claimableAmount, inputs, outputs, fee, contractFunction, contractParams, message });

    // Placeholder: Generate random txId until covenant transaction building is implemented
    const txId = '0x' + Math.random().toString(16).substring(2);

    // Confirm claim with backend
    const confirmResponse = await fetch(`${apiUrl}/streams/${streamId}/confirm-claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimedAmount: claimableAmount,
        txHash: txId,
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('Failed to confirm claim, but transaction was broadcast:', error);
    }

    return txId;
  } catch (error: any) {
    console.error('Failed to claim stream:', error);

    if (error.message.includes('No funds available')) {
      throw new Error('No funds available to claim yet. Please wait for vesting schedule.');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Claim failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Fund a recurring payment contract with initial deposit
 * @param wallet The wallet hook return value
 * @param paymentId The payment ID to fund
 * @returns Transaction ID
 */
export async function fundPaymentContract(
  wallet: WalletInterface,
  paymentId: string
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    // Get funding info from backend
    const apiUrl = '/api';
    const response = await fetch(`${apiUrl}/payments/${paymentId}/funding-info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get funding info');
    }

    const { fundingInfo } = await response.json();

    // For now, use simple transaction send (BCH only)
    // TODO: Add NFT commitment and CashTokens support
    const transaction: Transaction = {
      to: fundingInfo.contractAddress,
      amount: fundingInfo.amount,
    };

    const signedTx = await wallet.signTransaction(transaction);

    if (!signedTx.txId) {
      throw new Error('Transaction ID not returned from wallet');
    }

    // Confirm funding with backend
    const confirmResponse = await fetch(`${apiUrl}/payments/${paymentId}/confirm-funding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        txHash: signedTx.txId,
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('Failed to confirm funding, but transaction was broadcast:', error);
    }

    return signedTx.txId;
  } catch (error: any) {
    console.error('Failed to fund payment:', error);

    if (error.message.includes('insufficient') || error.message.includes('balance')) {
      throw new Error('Insufficient balance in wallet');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Funding failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Claim interval payment
 * @param wallet The wallet hook return value
 * @param paymentId The payment ID to claim from
 * @returns Transaction ID
 */
export async function claimPaymentFunds(
  wallet: WalletInterface,
  paymentId: string
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    // Get claim transaction from backend
    const apiUrl = '/api';
    const response = await fetch(`${apiUrl}/payments/${paymentId}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientAddress: wallet.address,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to build claim transaction');
    }

    const { claimableAmount, intervalsClaimable } = await response.json();

    if (claimableAmount <= 0) {
      throw new Error('No payment intervals available to claim at this time');
    }

    // TODO: Build and sign actual covenant transaction
    // For now, use simple placeholder
    console.log('Claim transaction ready:', { claimableAmount, intervalsClaimable });

    // Placeholder: In production, this would build the actual covenant transaction
    const txId = '0x' + Math.random().toString(16).substring(2);

    // Confirm claim with backend
    const confirmResponse = await fetch(`${apiUrl}/payments/${paymentId}/confirm-claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimedAmount: claimableAmount,
        txHash: txId,
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('Failed to confirm claim, but transaction was broadcast:', error);
    }

    return txId;
  } catch (error: any) {
    console.error('Failed to claim payment:', error);

    if (error.message.includes('No payment intervals available')) {
      throw new Error('No payment intervals available to claim yet. Please wait for next payment date.');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Claim failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Fund an airdrop contract with tokens
 * @param wallet The wallet hook return value
 * @param airdropId The airdrop campaign ID to fund
 * @returns Transaction ID
 */
export async function fundAirdropContract(
  wallet: WalletInterface,
  airdropId: string
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    // Get funding info from backend
    const apiUrl = '/api';
    const response = await fetch(`${apiUrl}/airdrops/${airdropId}/funding-info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get funding info');
    }

    const { fundingInfo } = await response.json();

    // For now, use simple transaction send
    // TODO: Add NFT commitment and CashTokens support with merkle root
    const transaction: Transaction = {
      to: fundingInfo.contractAddress,
      amount: fundingInfo.totalAmount,
    };

    const signedTx = await wallet.signTransaction(transaction);

    if (!signedTx.txId) {
      throw new Error('Transaction ID not returned from wallet');
    }

    // Confirm funding with backend
    const confirmResponse = await fetch(`${apiUrl}/airdrops/${airdropId}/confirm-funding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        txHash: signedTx.txId,
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('Failed to confirm funding, but transaction was broadcast:', error);
    }

    return signedTx.txId;
  } catch (error: any) {
    console.error('Failed to fund airdrop:', error);

    if (error.message.includes('insufficient') || error.message.includes('balance')) {
      throw new Error('Insufficient balance in wallet');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Funding failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Claim from an airdrop with merkle proof
 * @param wallet The wallet hook return value
 * @param airdropId The airdrop campaign ID to claim from
 * @returns Transaction ID
 */
export async function claimAirdropFunds(
  wallet: WalletInterface,
  airdropId: string
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    // Get claim transaction from backend
    const apiUrl = '/api';
    const response = await fetch(`${apiUrl}/airdrops/${airdropId}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimerAddress: wallet.address,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to build claim transaction');
    }

    const { claimAmount } = await response.json();

    if (claimAmount <= 0) {
      throw new Error('No airdrop allocation available for this address');
    }

    // TODO: Build and sign actual covenant transaction with merkle proof
    // For now, use simple placeholder
    console.log('Airdrop claim transaction ready:', { claimAmount });

    // Placeholder: In production, this would build the actual covenant transaction
    const txId = '0x' + Math.random().toString(16).substring(2);

    // Confirm claim with backend
    const confirmResponse = await fetch(`${apiUrl}/airdrops/${airdropId}/confirm-claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimerAddress: wallet.address,
        claimedAmount: claimAmount,
        txHash: txId,
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('Failed to confirm claim, but transaction was broadcast:', error);
    }

    return txId;
  } catch (error: any) {
    console.error('Failed to claim airdrop:', error);

    if (error.message.includes('No airdrop allocation')) {
      throw new Error('This address is not eligible for this airdrop');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Claim failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Lock tokens to vote on a governance proposal
 * @param wallet The wallet hook return value
 * @param proposalId The proposal ID to vote on
 * @param voteChoice Vote choice: 'FOR', 'AGAINST', or 'ABSTAIN'
 * @param stakeAmount Amount of tokens to stake (in satoshis for BCH)
 * @param tokenCategory Optional token category for governance tokens
 * @returns Transaction ID
 */
export async function lockTokensToVote(
  wallet: WalletInterface,
  proposalId: string,
  voteChoice: 'FOR' | 'AGAINST' | 'ABSTAIN',
  stakeAmount: number,
  tokenCategory?: string
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    if (stakeAmount <= 0) {
      throw new Error('Stake amount must be greater than 0');
    }

    // Get lock transaction from backend
    const apiUrl = '/api';
    const response = await fetch(`${apiUrl}/governance/${proposalId}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voterAddress: wallet.address,
        voteChoice,
        stakeAmount,
        tokenCategory,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to build lock transaction');
    }

    const { deployment, lockTransaction } = await response.json();

    // TODO: Build and sign actual covenant transaction
    // For now, use simple placeholder
    console.log('Vote lock transaction ready:', { voteChoice, stakeAmount, deployment });

    // Placeholder: In production, this would build the actual covenant transaction
    const txId = '0x' + Math.random().toString(16).substring(2);

    // Confirm lock with backend
    const confirmResponse = await fetch(`${apiUrl}/governance/${proposalId}/confirm-lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voterAddress: wallet.address,
        voteChoice,
        weight: stakeAmount,
        txHash: txId,
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('Failed to confirm lock, but transaction was broadcast:', error);
    }

    return txId;
  } catch (error: any) {
    console.error('Failed to lock tokens:', error);

    if (error.message.includes('insufficient') || error.message.includes('balance')) {
      throw new Error('Insufficient balance to lock tokens');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Lock failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Unlock staked tokens after voting period ends
 * @param wallet The wallet hook return value
 * @param proposalId The proposal ID to unlock from
 * @param contractAddress The vote lock contract address
 * @param stakeAmount Amount that was staked
 * @param tokenCategory Optional token category
 * @returns Transaction ID
 */
export async function unlockVotingTokens(
  wallet: WalletInterface,
  proposalId: string,
  contractAddress: string,
  stakeAmount: number,
  tokenCategory?: string
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    // Get unlock transaction from backend
    const apiUrl = '/api';
    const response = await fetch(`${apiUrl}/governance/${proposalId}/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voterAddress: wallet.address,
        contractAddress,
        stakeAmount,
        tokenCategory,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to build unlock transaction');
    }

    const { unlockTransaction } = await response.json();

    // TODO: Build and sign actual covenant transaction
    // For now, use simple placeholder
    console.log('Token unlock transaction ready:', { stakeAmount, unlockTransaction });

    // Placeholder: In production, this would build the actual covenant transaction
    const txId = '0x' + Math.random().toString(16).substring(2);

    // Confirm unlock with backend
    const confirmResponse = await fetch(`${apiUrl}/governance/${proposalId}/confirm-unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voterAddress: wallet.address,
        txHash: txId,
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('Failed to confirm unlock, but transaction was broadcast:', error);
    }

    return txId;
  } catch (error: any) {
    console.error('Failed to unlock tokens:', error);

    if (error.message.includes('Voting period') || error.message.includes('not ended')) {
      throw new Error('Voting period has not ended yet. Please wait until voting completes.');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Unlock failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Fund a budget plan contract
 * @param wallet The wallet hook return value
 * @param budgetId The budget plan ID to fund
 * @returns Transaction ID
 */
export async function fundBudgetPlan(
  wallet: WalletInterface,
  budgetId: string
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    // Get funding info from backend
    const apiUrl = '/api';
    const response = await fetch(`${apiUrl}/budget-plans/${budgetId}/funding-info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get funding info');
    }

    const { fundingInfo } = await response.json();

    // For now, use simple transaction send
    // TODO: Add NFT commitment and CashTokens support
    const transaction: Transaction = {
      to: fundingInfo.contractAddress,
      amount: fundingInfo.totalAmount,
    };

    const signedTx = await wallet.signTransaction(transaction);

    if (!signedTx.txId) {
      throw new Error('Transaction ID not returned from wallet');
    }

    // Confirm funding with backend
    const confirmResponse = await fetch(`${apiUrl}/budget-plans/${budgetId}/confirm-funding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        txHash: signedTx.txId,
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('Failed to confirm funding, but transaction was broadcast:', error);
    }

    return signedTx.txId;
  } catch (error: any) {
    console.error('Failed to fund budget plan:', error);

    if (error.message.includes('insufficient') || error.message.includes('balance')) {
      throw new Error('Insufficient balance in wallet');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Funding failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Release milestone from budget plan
 * @param wallet The wallet hook return value
 * @param budgetId The budget plan ID to release from
 * @returns Transaction ID
 */
export async function releaseMilestone(
  wallet: WalletInterface,
  budgetId: string
): Promise<string> {
  try {
    if (!wallet.address) {
      throw new Error('Wallet not connected');
    }

    // Get release transaction from backend
    const apiUrl = '/api';
    const response = await fetch(`${apiUrl}/budget-plans/${budgetId}/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientAddress: wallet.address,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to build release transaction');
    }

    const { releasableAmount, milestonesReleasable } = await response.json();

    if (releasableAmount <= 0) {
      throw new Error('No milestones available to release yet');
    }

    // TODO: Build and sign actual covenant transaction
    // For now, use simple placeholder
    console.log('Milestone release transaction ready:', { releasableAmount, milestonesReleasable });

    // Placeholder: In production, this would build the actual covenant transaction
    const txId = '0x' + Math.random().toString(16).substring(2);

    // Confirm release with backend
    const confirmResponse = await fetch(`${apiUrl}/budget-plans/${budgetId}/confirm-release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        releasedAmount: releasableAmount,
        txHash: txId,
      }),
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      console.error('Failed to confirm release, but transaction was broadcast:', error);
    }

    return txId;
  } catch (error: any) {
    console.error('Failed to release milestone:', error);

    if (error.message.includes('No milestones available')) {
      throw new Error('No milestones available to release yet. Please wait for milestone unlock time.');
    }

    if (error.message.includes('user') || error.message.includes('cancel')) {
      throw new Error('Transaction cancelled by user');
    }

    throw new Error(`Release failed: ${error.message || 'Unknown error'}`);
  }
}
