/**
 * Wallet Types and Interfaces for FlowGuard
 * Supports both Selene and mainnet.cash wallets
 */

export enum WalletType {
  SELENE = 'selene',
  MAINNET = 'mainnet',
}

export interface WalletBalance {
  bch: number;
  sat: number;
}

export interface Transaction {
  to: string;
  amount: number; // in satoshis
  data?: string;
}

export interface SignedTransaction {
  txId: string;
  hex: string;
}

export interface WalletInfo {
  address: string;
  publicKey?: string;
  balance?: WalletBalance;
  network: 'mainnet' | 'testnet' | 'chipnet';
}

export interface IWalletConnector {
  type: WalletType;
  isAvailable(): Promise<boolean>;
  connect(): Promise<WalletInfo>;
  disconnect(): Promise<void>;
  getAddress(): Promise<string>;
  getBalance(): Promise<WalletBalance>;
  signTransaction(tx: Transaction): Promise<SignedTransaction>;
  signMessage(message: string): Promise<string>;
}

export interface WalletState {
  walletType: WalletType | null;
  address: string | null;
  balance: WalletBalance | null;
  isConnected: boolean;
  isConnecting: boolean;
  network: 'mainnet' | 'testnet' | 'chipnet';
  error: string | null;
}

export interface WalletActions {
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<SignedTransaction>;
  signMessage: (message: string) => Promise<string>;
  refreshBalance: () => Promise<void>;
}
