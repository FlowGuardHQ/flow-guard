/**
 * Contract Service - Handles blockchain interactions
 * Deploys contracts, creates transactions, monitors blockchain
 */

import { Contract, ElectrumNetworkProvider } from 'cashscript';
import {
  hash160,
  hexToBin,
  binToHex,
  cashAddressToLockingBytecode,
} from '@bitauth/libauth';
import { ContractFactory } from './ContractFactory.js';

export interface VaultDeployment {
  contractAddress: string;
  contractId: string;
  bytecode: string;
  constructorParams: ConstructorParam[];
}

export interface ConstructorParam {
  type: 'bigint' | 'bytes' | 'string' | 'boolean';
  value: string; // hex for bytes, string representation for others
}

export interface ProposalTransaction {
  txHex: string;
  txId: string;
  requiresSignatures: string[];
}

export interface UTXO {
  txid: string;
  vout: number;
  satoshis: number;
  height?: number;
}

export interface VaultParams {
  signerPubkeys: string[]; // hex-encoded compressed pubkeys
  requiredApprovals: number;
  periodDuration: number; // seconds (0 = unlimited)
  periodCap: number; // satoshis (0 = unlimited)
  recipientCap: number; // satoshis (0 = unlimited)
  allowlistEnabled: boolean;
  allowedAddresses?: string[]; // BCH cashaddr (up to 3)
}

export class ContractService {
  private provider: ElectrumNetworkProvider;
  private network: 'mainnet' | 'testnet3' | 'testnet4' | 'chipnet';

  constructor(network: 'mainnet' | 'testnet3' | 'testnet4' | 'chipnet' = 'chipnet') {
    this.network = network;
    this.provider = new ElectrumNetworkProvider(network);
  }

  /**
   * Compute hash160 of a hex-encoded compressed pubkey
   */
  static pubkeyToHash160(pubkeyHex: string): Uint8Array {
    return hash160(hexToBin(pubkeyHex));
  }

  /**
   * Extract hash160 from a P2PKH cashaddr
   */
  private addressToHash160(address: string): Uint8Array {
    const decoded = cashAddressToLockingBytecode(address);
    if (typeof decoded === 'string') throw new Error(decoded);
    const b = decoded.bytecode;
    const isP2pkh = b.length === 25
      && b[0] === 0x76
      && b[1] === 0xa9
      && b[2] === 0x14
      && b[23] === 0x88
      && b[24] === 0xac;
    if (!isP2pkh) {
      throw new Error(`Vault allowlist entries must be P2PKH addresses: ${address}`);
    }
    return b.slice(3, 23);
  }

  /**
   * Generate a deterministic vaultId from signer hashes + creation timestamp
   */
  private generateVaultId(signerHashes: Uint8Array[], createdAt: number): Uint8Array {
    // Simple derivation: hash160(concat(signer hashes + 8-byte timestamp))
    const combined = new Uint8Array(60 + 8); // 3 * 20 + 8
    combined.set(signerHashes[0], 0);
    combined.set(signerHashes[1], 20);
    combined.set(signerHashes[2], 40);
    const tsView = new DataView(combined.buffer, 60, 8);
    tsView.setBigUint64(0, BigInt(createdAt), true);
    // Pad to 32 bytes: take hash160 and prepend 12 zero bytes
    const h = hash160(combined);
    const id = new Uint8Array(32);
    id.set(h, 12);
    return id;
  }

  /**
   * Deploy (instantiate) a new VaultCovenant.
   * Does NOT broadcast — returns the deterministic contract address.
   */
  async deployVault(params: VaultParams): Promise<VaultDeployment> {
    if (params.signerPubkeys.length !== 3) {
      throw new Error('Exactly 3 signer public keys are required');
    }

    const artifact = ContractFactory.getArtifact('VaultCovenant');

    const signer1Hash = ContractService.pubkeyToHash160(params.signerPubkeys[0]);
    const signer2Hash = ContractService.pubkeyToHash160(params.signerPubkeys[1]);
    const signer3Hash = ContractService.pubkeyToHash160(params.signerPubkeys[2]);

    const vaultId = this.generateVaultId([signer1Hash, signer2Hash, signer3Hash], Date.now());

    // Allowlist addresses → hash160 (up to 3, pad with zeros)
    const addrs = (params.allowedAddresses || []).slice(0, 3);
    const allowlistHashes: Uint8Array[] = [
      new Uint8Array(20),
      new Uint8Array(20),
      new Uint8Array(20),
    ];
    for (let i = 0; i < addrs.length; i++) {
      allowlistHashes[i] = this.addressToHash160(addrs[i]);
    }

    const contract = new Contract(
      artifact,
      [
        vaultId,
        BigInt(params.requiredApprovals),
        signer1Hash,
        signer2Hash,
        signer3Hash,
        BigInt(params.periodDuration),
        BigInt(params.periodCap),
        BigInt(params.recipientCap),
        BigInt(params.allowlistEnabled ? 1 : 0),
        allowlistHashes[0],
        allowlistHashes[1],
        allowlistHashes[2],
      ],
      { provider: this.provider }
    );

    console.log('VaultCovenant instantiated:', {
      address: contract.address,
      vaultId: binToHex(vaultId),
      network: this.network,
    });

    // Return constructor params in serializable format for storage
    const constructorParams: ConstructorParam[] = [
      { type: 'bytes', value: binToHex(vaultId) },
      { type: 'bigint', value: params.requiredApprovals.toString() },
      { type: 'bytes', value: binToHex(signer1Hash) },
      { type: 'bytes', value: binToHex(signer2Hash) },
      { type: 'bytes', value: binToHex(signer3Hash) },
      { type: 'bigint', value: params.periodDuration.toString() },
      { type: 'bigint', value: params.periodCap.toString() },
      { type: 'bigint', value: params.recipientCap.toString() },
      { type: 'bigint', value: (params.allowlistEnabled ? 1 : 0).toString() },
      { type: 'bytes', value: binToHex(allowlistHashes[0]) },
      { type: 'bytes', value: binToHex(allowlistHashes[1]) },
      { type: 'bytes', value: binToHex(allowlistHashes[2]) },
    ];

    return {
      contractAddress: contract.address,
      contractId: binToHex(vaultId),
      bytecode: artifact.bytecode,
      constructorParams,
    };
  }

  /**
   * Instantiate a VaultCovenant from stored parameters (for tx building)
   */
  getVaultContract(
    signerPubkeys: string[],
    requiredApprovals: number,
    vaultId: string, // hex-encoded 32-byte vault ID
    periodDuration: number,
    periodCap: number,
    recipientCap: number,
    allowlistEnabled: boolean,
    allowedAddresses?: string[]
  ): Contract {
    const artifact = ContractFactory.getArtifact('VaultCovenant');

    const signer1Hash = ContractService.pubkeyToHash160(signerPubkeys[0]);
    const signer2Hash = ContractService.pubkeyToHash160(signerPubkeys[1]);
    const signer3Hash = ContractService.pubkeyToHash160(signerPubkeys[2]);

    const addrs = (allowedAddresses || []).slice(0, 3);
    const allowlistHashes: Uint8Array[] = [
      new Uint8Array(20),
      new Uint8Array(20),
      new Uint8Array(20),
    ];
    for (let i = 0; i < addrs.length; i++) {
      allowlistHashes[i] = this.addressToHash160(addrs[i]);
    }

    return new Contract(
      artifact,
      [
        hexToBin(vaultId),
        BigInt(requiredApprovals),
        signer1Hash,
        signer2Hash,
        signer3Hash,
        BigInt(periodDuration),
        BigInt(periodCap),
        BigInt(recipientCap),
        BigInt(allowlistEnabled ? 1 : 0),
        allowlistHashes[0],
        allowlistHashes[1],
        allowlistHashes[2],
      ],
      { provider: this.provider }
    );
  }

  /**
   * Instantiate a ProposalCovenant
   */
  getProposalContract(
    vaultId: string,
    signerPubkeys: string[],
    requiredApprovals: number
  ): Contract {
    const artifact = ContractFactory.getArtifact('ProposalCovenant');

    return new Contract(
      artifact,
      [
        hexToBin(vaultId),
        ContractService.pubkeyToHash160(signerPubkeys[0]),
        ContractService.pubkeyToHash160(signerPubkeys[1]),
        ContractService.pubkeyToHash160(signerPubkeys[2]),
        BigInt(requiredApprovals),
      ],
      { provider: this.provider }
    );
  }

  /**
   * Get balance of a contract address
   */
  async getBalance(contractAddress: string): Promise<number> {
    try {
      const utxos = await this.provider.getUtxos(contractAddress);
      return utxos.reduce((sum, utxo) => sum + Number(utxo.satoshis), 0);
    } catch {
      return 0;
    }
  }

  /**
   * Get all UTXOs for a contract address
   */
  async getUTXOs(contractAddress: string): Promise<UTXO[]> {
    try {
      const utxos = await this.provider.getUtxos(contractAddress);
      return utxos.map((utxo: any) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        satoshis: Number(utxo.satoshis),
        height: utxo.height || undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Broadcast a signed transaction to the network
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    try {
      const txid = await this.provider.sendRawTransaction(txHex);
      console.log('Transaction broadcast:', txid);
      return txid;
    } catch (error) {
      throw new Error(`Broadcast failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get block height
   */
  async getBlockHeight(): Promise<number> {
    try {
      return await this.provider.getBlockHeight();
    } catch {
      return 0;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<any> {
    try {
      return await this.provider.getRawTransaction(txid);
    } catch {
      return null;
    }
  }

  /**
   * Get NFT commitment from covenant UTXO
   * Returns hex-encoded commitment or null if not found
   */
  async getNFTCommitment(contractAddress: string): Promise<string | null> {
    try {
      const utxos = await this.provider.getUtxos(contractAddress);

      if (utxos.length === 0) {
        return null;
      }

      // Find UTXO with NFT token
      for (const utxo of utxos) {
        const commitment = (utxo as any).token?.nft?.commitment as unknown;
        if (commitment == null) continue;

        // Return hex-encoded commitment
        if (typeof commitment === 'string') {
          return commitment;
        }
        if (commitment instanceof Uint8Array) {
          return binToHex(commitment);
        }
      }

      return null;
    } catch (error) {
      console.error(`Failed to get NFT commitment for ${contractAddress}:`, error);
      return null;
    }
  }
}
