/**
 * Vote Lock Service
 * Builds a WcTransactionObject for locking governance tokens into VoteLockCovenant.
 *
 * The lock is a standard user-signed transaction:
 *   Inputs:  voter's FT UTXO(s) + voter's NFT UTXO (for vote commitment) + BCH for fees
 *   Output 0: VoteLockCovenant address — stakeAmount FTs + mutable NFT (vote commitment)
 *   Output 1: voter change (remaining FTs if any)
 *   Output 2: voter BCH change
 *
 * We build the TransactionCommon directly via libauth so the wallet can recognize
 * P2PKH inputs and sign them via wallet.signCashScriptTransaction().
 *
 * REQUIREMENT: The voter must have a mutable or minting NFT UTXO of the governance
 * token category so the lock output can carry the vote NFT commitment. If none is
 * found, an error is thrown prompting them to obtain one from the governance admin.
 */

import { ElectrumNetworkProvider, type WcTransactionObject } from 'cashscript';
import { hexToBin, binToHex, cashAddressToLockingBytecode } from '@bitauth/libauth';

export interface LockTransactionParams {
  contractAddress: string;
  voterAddress: string;
  stakeAmount: number;     // governance token count (not satoshis)
  tokenCategory: string;   // hex category ID
  nftCommitment: string;   // hex — vote commitment bytes for the mutable NFT
}

export class VoteLockService {
  private provider: ElectrumNetworkProvider;

  constructor(network: 'mainnet' | 'testnet3' | 'testnet4' | 'chipnet' = 'chipnet') {
    this.provider = new ElectrumNetworkProvider(network);
  }

  async buildLockTransaction(params: LockTransactionParams): Promise<WcTransactionObject> {
    const { contractAddress, voterAddress, stakeAmount, tokenCategory, nftCommitment } = params;

    const stakeAmountBig = BigInt(stakeAmount);
    const utxos = await this.provider.getUtxos(voterAddress);
    if (!utxos?.length) throw new Error(`No UTXOs found for voter ${voterAddress}`);

    // Find FT UTXOs (governance tokens, no NFT)
    const ftUtxos = utxos.filter(u =>
      u.token?.category === tokenCategory && u.token.amount > 0n && !u.token.nft
    );

    // Find a mutable/minting NFT UTXO of the same category — needed to carry the vote commitment
    const nftUtxo = utxos.find(u =>
      u.token?.category === tokenCategory &&
      u.token.nft != null &&
      (u.token.nft.capability === 'mutable' || u.token.nft.capability === 'minting')
    );
    if (!nftUtxo) {
      throw new Error(
        `No governance NFT UTXO found for category ${tokenCategory}. ` +
        `Contact the governance admin to receive a vote NFT before locking.`
      );
    }
    const nftTokenAmount = nftUtxo.token?.amount ?? 0n;

    // Select FT UTXOs to cover stakeAmount
    let ftTotal = 0n;
    const selectedFtUtxos: typeof utxos = [];
    const requiredFromFt = stakeAmountBig > nftTokenAmount ? stakeAmountBig - nftTokenAmount : 0n;
    for (const utxo of ftUtxos) {
      if (ftTotal >= requiredFromFt) break;
      selectedFtUtxos.push(utxo);
      ftTotal += utxo.token!.amount;
    }
    const totalTokenInput = ftTotal + nftTokenAmount;
    if (totalTokenInput < stakeAmountBig) {
      throw new Error(
        `Insufficient governance tokens. Required: ${stakeAmount}, Available: ${totalTokenInput}`
      );
    }

    // BCH UTXOs for fees
    const bchUtxos = utxos.filter(u => !u.token);

    const dustAmount = 1000n;
    const fee = 2500n; // conservative estimate
    const ftChange = totalTokenInput - stakeAmountBig;
    const numOutputs = 1 + (ftChange > 0n ? 1 : 0) + 1; // contract + ftChange? + bchChange
    const bchNeeded = dustAmount + fee + (ftChange > 0n ? dustAmount : 0n);

    // Accumulate BCH from FT+NFT UTXOs first (they carry dust)
    let bchTotal = 0n;
    const allInputUtxos = [...selectedFtUtxos, nftUtxo];
    for (const u of allInputUtxos) bchTotal += u.satoshis;

    // Add plain BCH UTXOs if needed for fees
    for (const utxo of bchUtxos) {
      if (bchTotal >= bchNeeded) break;
      allInputUtxos.push(utxo);
      bchTotal += utxo.satoshis;
    }
    if (bchTotal < bchNeeded) {
      throw new Error(`Insufficient BCH for fees. Needed: ${bchNeeded} sat, Available: ${bchTotal} sat`);
    }

    // Compute locking bytecodes
    const voterLockingResult = cashAddressToLockingBytecode(voterAddress);
    if (typeof voterLockingResult === 'string') throw new Error(voterLockingResult);
    const voterLocking = voterLockingResult.bytecode;

    const contractLockingResult = cashAddressToLockingBytecode(contractAddress);
    if (typeof contractLockingResult === 'string') throw new Error(contractLockingResult);
    const contractLocking = contractLockingResult.bytecode;

    // Token category bytes (Electrum returns big-endian display format)
    const categoryBytes = hexToBin(tokenCategory);

    // Build transaction inputs (unsigned — wallet fills in P2PKH signatures)
    const inputs = allInputUtxos.map(utxo => ({
      outpointTransactionHash: hexToBin(utxo.txid).slice().reverse(), // little-endian in tx
      outpointIndex: utxo.vout,
      unlockingBytecode: new Uint8Array(0), // unsigned
      sequenceNumber: 0xfffffffe,
    }));

    // Build outputs
    // Output 0: contract — FTs + mutable NFT (vote commitment)
    const outputs: Array<{
      lockingBytecode: Uint8Array;
      valueSatoshis: bigint;
      token?: {
        category: Uint8Array;
        amount: bigint;
        nft?: { capability: 'none' | 'mutable' | 'minting'; commitment: Uint8Array };
      };
    }> = [
      {
        lockingBytecode: contractLocking,
        valueSatoshis: dustAmount,
        token: {
          category: categoryBytes,
          amount: stakeAmountBig,
          nft: {
            capability: 'mutable',
            commitment: hexToBin(nftCommitment),
          },
        },
      },
    ];

    // Output 1 (optional): FT change back to voter
    if (ftChange > 0n) {
      outputs.push({
        lockingBytecode: voterLocking,
        valueSatoshis: dustAmount,
        token: {
          category: categoryBytes,
          amount: ftChange,
        },
      });
    }

    // Output 2: BCH change back to voter
    const bchChange = bchTotal - dustAmount - fee - (ftChange > 0n ? dustAmount : 0n);
    if (bchChange > 546n) {
      outputs.push({
        lockingBytecode: voterLocking,
        valueSatoshis: bchChange,
      });
    }

    const transaction = {
      version: 2,
      inputs,
      outputs,
      locktime: 0,
    };

    // Source outputs = the UTXOs being spent, so wallet knows how to sign each input
    const sourceOutputs = allInputUtxos.map((utxo, i) => {
      const so: {
        outpointTransactionHash: Uint8Array;
        outpointIndex: number;
        unlockingBytecode: Uint8Array;
        sequenceNumber: number;
        lockingBytecode: Uint8Array;
        valueSatoshis: bigint;
        token?: {
          category: Uint8Array;
          amount: bigint;
          nft?: { capability: 'none' | 'mutable' | 'minting'; commitment: Uint8Array };
        };
      } = {
        outpointTransactionHash: inputs[i].outpointTransactionHash,
        outpointIndex: utxo.vout,
        unlockingBytecode: new Uint8Array(0),
        sequenceNumber: 0xfffffffe,
        lockingBytecode: voterLocking, // all voter UTXOs are P2PKH
        valueSatoshis: utxo.satoshis,
      };

      if (utxo.token) {
        so.token = {
          category: hexToBin(utxo.token.category),
          amount: utxo.token.amount,
          ...(utxo.token.nft ? {
            nft: {
              capability: utxo.token.nft.capability as 'none' | 'mutable' | 'minting',
              commitment: hexToBin(utxo.token.nft.commitment),
            },
          } : {}),
        };
      }

      return so;
    });

    // WcTransactionObject — transaction is the raw TransactionCommon (libauth compatible)
    return {
      transaction: transaction as any, // TransactionCommon — libauth type, cast for compat
      sourceOutputs,
      broadcast: true,
    };
  }
}
