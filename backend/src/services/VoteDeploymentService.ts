/**
 * Vote Deployment Service
 * Computes VoteLockCovenant address (deterministic from constructor args).
 * No on-chain transaction — the actual lock tx is built by VoteLockService.
 *
 * Artifact constructor: (bytes32 proposalId, int voteChoice, bytes20 voterHash, int unlockTimestamp)
 *   voteChoice: 0=AGAINST, 1=FOR, 2=ABSTAIN
 */

import { Contract, ElectrumNetworkProvider } from 'cashscript';
import { hash160, hexToBin, binToHex, cashAddressToLockingBytecode } from '@bitauth/libauth';
import { ContractFactory, type ConstructorParam } from './ContractFactory.js';

export interface VoteDeploymentParams {
  proposalId: string;         // UUID string, e.g. "550e8400-e29b-41d4-a716-446655440000"
  voter: string;              // BCH address of the voter
  voteChoice: 'ABSTAIN' | 'FOR' | 'AGAINST';
  stakeAmount: number;        // Token count (not satoshis)
  votingPeriodEnd: number;    // Unix timestamp when voting ends
  tokenCategory?: string;     // hex governance token category
}

export interface VoteDeployment {
  contractAddress: string;
  voteId: string;             // hex — unique per-vote identifier
  constructorParams: ConstructorParam[];
  initialCommitment: string;  // hex-encoded 32-byte NFT commitment
  fundingTxRequired: {
    toAddress: string;
    amount: number;           // satoshis (dust)
    tokenCategory: string;
    tokenAmount: number;      // governance tokens to lock
    withNFT: { commitment: string; capability: 'mutable' };
  };
}

const VOTE_CHOICE_NUM: Record<VoteDeploymentParams['voteChoice'], bigint> = {
  AGAINST: 0n,
  FOR: 1n,
  ABSTAIN: 2n,
};

export class VoteDeploymentService {
  private provider: ElectrumNetworkProvider;
  private network: 'mainnet' | 'testnet3' | 'testnet4' | 'chipnet';

  constructor(network: 'mainnet' | 'testnet3' | 'testnet4' | 'chipnet' = 'chipnet') {
    this.network = network;
    this.provider = new ElectrumNetworkProvider(network);
  }

  /** Convert BCH address to 20-byte hash160 */
  private addressToHash160(address: string): Uint8Array {
    const decoded = cashAddressToLockingBytecode(address);
    if (typeof decoded === 'string') throw new Error(`Invalid address: ${decoded}`);
    const b = decoded.bytecode;
    const isP2pkh = b.length === 25
      && b[0] === 0x76
      && b[1] === 0xa9
      && b[2] === 0x14
      && b[23] === 0x88
      && b[24] === 0xac;
    if (!isP2pkh) {
      throw new Error(`Vote locking currently requires P2PKH voter addresses: ${address}`);
    }
    return b.slice(3, 23);
  }

  /**
   * Convert UUID proposal ID to bytes32.
   * UUID stripped of dashes = 32 hex chars = 16 bytes; zero-padded to 32 bytes.
   */
  private proposalIdToBytes32(proposalId: string): Uint8Array {
    const hex = proposalId.replace(/-/g, ''); // 32 hex chars = 16 bytes
    if (hex.length !== 32) {
      throw new Error(`Invalid proposal ID format: ${proposalId}`);
    }
    const bytes = new Uint8Array(32);
    bytes.set(hexToBin(hex)); // first 16 bytes = UUID; last 16 = zero-padding
    return bytes;
  }

  /**
   * Generate a unique vote ID (20 bytes → padded to 32 for storage as hex).
   * Based on proposalId + voter + timestamp.
   */
  private generateVoteId(proposalId: string, voter: string): string {
    const proposalIdBytes = this.proposalIdToBytes32(proposalId);
    const voterHash = this.addressToHash160(voter);
    const tsBuf = new Uint8Array(8);
    new DataView(tsBuf.buffer).setBigUint64(0, BigInt(Date.now()), true);

    const combined = new Uint8Array(32 + 20 + 8);
    combined.set(proposalIdBytes, 0);
    combined.set(voterHash, 32);
    combined.set(tsBuf, 52);

    return binToHex(hash160(combined));
  }

  /**
   * Build the 32-byte NFT commitment for the VoteLockCovenant UTXO.
   *
   * Layout (matching contract source comments):
   *   [0]:     version = 1
   *   [1-4]:   first 4 bytes of proposalId
   *   [5]:     voteChoice (0=AGAINST, 1=FOR, 2=ABSTAIN)
   *   [6-7]:   reserved
   *   [8-12]:  lock_timestamp  (5 bytes, unix seconds)
   *   [13-17]: unlock_timestamp (5 bytes, unix seconds)
   *   [18-31]: reserved / zero
   */
  private buildNftCommitment(
    proposalIdBytes32: Uint8Array,
    voteChoice: VoteDeploymentParams['voteChoice'],
    votingPeriodEnd: number,
  ): Uint8Array {
    const c = new Uint8Array(32);
    c[0] = 1; // version
    c.set(proposalIdBytes32.slice(0, 4), 1); // proposalId prefix
    c[5] = Number(VOTE_CHOICE_NUM[voteChoice]);
    // lock_timestamp = now (bytes 8-12, 5 bytes LE)
    const now = Math.floor(Date.now() / 1000);
    const dv = new DataView(c.buffer);
    dv.setUint32(8, now & 0xffffffff, true);
    c[12] = (now / 0x100000000) & 0xff;
    // unlock_timestamp (bytes 13-17, 5 bytes LE)
    dv.setUint32(13, votingPeriodEnd & 0xffffffff, true);
    c[17] = (votingPeriodEnd / 0x100000000) & 0xff;
    return c;
  }

  /** Compute VoteLockCovenant address and serialized params — no on-chain tx */
  async deployVoteLock(params: VoteDeploymentParams): Promise<VoteDeployment> {
    const artifact = ContractFactory.getArtifact('VoteLockCovenant');

    const proposalIdBytes32 = this.proposalIdToBytes32(params.proposalId);
    const voteChoiceNum = VOTE_CHOICE_NUM[params.voteChoice];
    const voterHash = this.addressToHash160(params.voter);
    const unlockTimestamp = BigInt(params.votingPeriodEnd);

    const constructorArgs = [
      proposalIdBytes32,  // bytes32 proposalId
      voteChoiceNum,      // int voteChoice  (0=AGAINST, 1=FOR, 2=ABSTAIN)
      voterHash,          // bytes20 voterHash
      unlockTimestamp,    // int unlockTimestamp
    ];

    const contract = new Contract(artifact, constructorArgs, { provider: this.provider });

    const initialCommitment = this.buildNftCommitment(
      proposalIdBytes32,
      params.voteChoice,
      params.votingPeriodEnd,
    );

    const constructorParams: ConstructorParam[] = [
      { type: 'bytes', value: binToHex(proposalIdBytes32) },
      { type: 'bigint', value: voteChoiceNum.toString() },
      { type: 'bytes', value: binToHex(voterHash) },
      { type: 'bigint', value: unlockTimestamp.toString() },
    ];

    return {
      contractAddress: contract.address,
      voteId: this.generateVoteId(params.proposalId, params.voter),
      constructorParams,
      initialCommitment: binToHex(initialCommitment),
      fundingTxRequired: {
        toAddress: contract.address,
        amount: 1000,
        tokenCategory: params.tokenCategory || '',
        tokenAmount: params.stakeAmount,
        withNFT: { commitment: binToHex(initialCommitment), capability: 'mutable' },
      },
    };
  }
}
