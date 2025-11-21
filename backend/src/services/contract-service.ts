/**
 * Contract Service - Handles blockchain interactions
 * Deploys contracts, creates transactions, monitors blockchain
 */

import { Contract, ElectrumNetworkProvider, SignatureTemplate } from 'cashscript';
import { binToHex, hexToBin } from '@bitauth/libauth';
import artifact from '../contracts/FlowGuardDemo.json';

export interface VaultDeployment {
  contractAddress: string;
  contractId: string;
  bytecode: string;
}

export interface ProposalTransaction {
  txHex: string;
  txId: string;
  requiresSignatures: string[]; // Pubkeys that need to sign
}

export interface UTXO {
  txid: string;
  vout: number;
  satoshis: number;
  height?: number;
}

/**
 * Service for interacting with BCH blockchain and FlowGuard contracts
 */
export class ContractService {
  private provider: ElectrumNetworkProvider;
  private network: 'mainnet' | 'testnet' | 'regtest' | 'chipnet';

  constructor(network: 'mainnet' | 'testnet' | 'regtest' | 'chipnet' = 'chipnet') {
    this.network = network;
    this.provider = new ElectrumNetworkProvider(network);
  }

  /**
   * Deploy a new vault contract to the blockchain
   * @param signer1 First signer's public key (hex)
   * @param signer2 Second signer's public key (hex)
   * @param signer3 Third signer's public key (hex)
   * @param approvalThreshold Number of signatures required (e.g., 2 for 2-of-3)
   */
  async deployVault(
    signer1: string,
    signer2: string,
    signer3: string,
    approvalThreshold: number
  ): Promise<VaultDeployment> {
    try {
      // Convert hex pubkeys to Uint8Array
      const pk1 = hexToBin(signer1);
      const pk2 = hexToBin(signer2);
      const pk3 = hexToBin(signer3);

      // Create contract instance
      const contract = new Contract(
        artifact as any,
        [pk1, pk2, pk3, BigInt(approvalThreshold)],
        { provider: this.provider }
      );

      console.log('Contract deployed:', {
        address: contract.address,
        network: this.network,
      });

      return {
        contractAddress: contract.address,
        contractId: contract.toString(),
        bytecode: binToHex(contract.redeemScript),
      };
    } catch (error) {
      console.error('Failed to deploy vault:', error);
      throw new Error(`Contract deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get contract instance from address
   * @param contractAddress The contract's cashaddr
   */
  private async getContract(
    contractAddress: string,
    signer1: string,
    signer2: string,
    signer3: string,
    approvalThreshold: number
  ): Promise<Contract> {
    const pk1 = hexToBin(signer1);
    const pk2 = hexToBin(signer2);
    const pk3 = hexToBin(signer3);

    const contract = new Contract(
      artifact as any,
      [pk1, pk2, pk3, BigInt(approvalThreshold)],
      { provider: this.provider }
    );

    // Verify the contract address matches
    if (contract.address !== contractAddress) {
      throw new Error('Contract parameters do not match the given address');
    }

    return contract;
  }

  /**
   * Get balance of a contract address
   * @param contractAddress The contract's cashaddr
   */
  async getBalance(contractAddress: string): Promise<number> {
    try {
      const utxos = await this.provider.getUtxos(contractAddress);
      const balance = utxos.reduce((sum, utxo) => sum + Number(utxo.satoshis), 0);
      return balance;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return 0;
    }
  }

  /**
   * Get all UTXOs for a contract address
   * @param contractAddress The contract's cashaddr
   */
  async getUTXOs(contractAddress: string): Promise<UTXO[]> {
    try {
      const utxos = await this.provider.getUtxos(contractAddress);
      return utxos.map((utxo) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        satoshis: Number(utxo.satoshis),
        height: utxo.height,
      }));
    } catch (error) {
      console.error('Failed to get UTXOs:', error);
      return [];
    }
  }

  /**
   * Create a proposal transaction (unsigned)
   * This creates the transaction hex that signers will sign
   *
   * @param contractAddress The vault contract address
   * @param recipientAddress Where to send the funds
   * @param amount Amount to send in satoshis
   * @param signerPublicKeys Array of signer public keys
   * @param approvalThreshold Number of signatures required
   */
  async createProposal(
    contractAddress: string,
    recipientAddress: string,
    amount: number,
    signerPublicKeys: string[],
    approvalThreshold: number
  ): Promise<ProposalTransaction> {
    try {
      if (signerPublicKeys.length !== 3) {
        throw new Error('Exactly 3 signer public keys required');
      }

      const [signer1, signer2, signer3] = signerPublicKeys;

      // Get contract instance
      const contract = await this.getContract(
        contractAddress,
        signer1,
        signer2,
        signer3,
        approvalThreshold
      );

      // For now, we'll use placeholder signatures
      // In production, this would be signed by the actual signers
      const pk1 = hexToBin(signer1);
      const pk2 = hexToBin(signer2);
      const pk3 = hexToBin(signer3);

      // Create placeholder signatures (empty)
      const emptySignature = new Uint8Array(65);

      // Build the transaction
      const transaction = await contract.functions
        .payout(pk1, emptySignature, pk2, emptySignature, pk3, emptySignature)
        .to(recipientAddress, BigInt(amount))
        .withHardcodedFee(BigInt(1000)) // 1000 sats fee
        .build();

      return {
        txHex: transaction.toString(),
        txId: '', // Will be set after signing
        requiresSignatures: signerPublicKeys,
      };
    } catch (error) {
      console.error('Failed to create proposal:', error);
      throw new Error(`Proposal creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Broadcast a signed transaction to the network
   * @param txHex The signed transaction hex
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    try {
      const txid = await this.provider.sendRawTransaction(txHex);
      console.log('Transaction broadcast:', txid);
      return txid;
    } catch (error) {
      console.error('Failed to broadcast transaction:', error);
      throw new Error(`Transaction broadcast failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Monitor a transaction until it's confirmed
   * @param txid Transaction ID to monitor
   * @param maxAttempts Maximum number of attempts (default: 60)
   * @param delayMs Delay between attempts in ms (default: 10000 = 10s)
   */
  async waitForConfirmation(
    txid: string,
    maxAttempts: number = 60,
    delayMs: number = 10000
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const txInfo = await this.provider.getRawTransaction(txid, true) as any;
        if (txInfo && txInfo.confirmations && txInfo.confirmations > 0) {
          console.log(`Transaction ${txid} confirmed with ${txInfo.confirmations} confirmations`);
          return true;
        }
      } catch (error) {
        // Transaction not found yet, continue waiting
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    console.warn(`Transaction ${txid} not confirmed after ${maxAttempts} attempts`);
    return false;
  }

  /**
   * Get transaction details
   * @param txid Transaction ID
   */
  async getTransaction(txid: string): Promise<any> {
    try {
      return await this.provider.getRawTransaction(txid, true);
    } catch (error) {
      console.error('Failed to get transaction:', error);
      return null;
    }
  }

  /**
   * Get block height
   */
  async getBlockHeight(): Promise<number> {
    try {
      return await this.provider.getBlockHeight();
    } catch (error) {
      console.error('Failed to get block height:', error);
      return 0;
    }
  }
}
