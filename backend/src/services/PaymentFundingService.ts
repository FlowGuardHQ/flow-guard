/**
 * Payment Funding Service
 * Builds funding transactions for recurring payment contracts
 */

import { ElectrumNetworkProvider, type WcTransactionObject } from 'cashscript';
import { buildFundingWcTransaction } from '../utils/wcFundingBuilder.js';
import { toNonNegativeBigInt } from '../utils/bigint.js';
import { getTokenFundingSatoshis, getTokenOutputDustSatoshis } from '../utils/fundingConfig.js';

export interface TransactionOutput {
  to: string;
  amount: number | string;
  token?: {
    category: string;
    amount: number | string;
    nft?: {
      commitment: string;
      capability: 'minting' | 'mutable' | 'none';
    };
  };
}

export interface FundingTransactionParams {
  contractAddress: string;
  senderAddress: string;
  amount: number | string | bigint; // satoshis or token amount
  tokenType?: 'BCH' | 'FUNGIBLE_TOKEN';
  tokenCategory?: string;
  nftCommitment: string;
  nftCapability: 'minting' | 'mutable' | 'none';
}

export interface UnsignedFundingTransaction {
  inputs: Array<{
    txid: string;
    vout: number;
    satoshis: number;
    tokenCategory?: string;
    tokenAmount?: number | string;
  }>;
  outputs: TransactionOutput[];
  fee: number;
  txHex: string; // JSON-encoded params
  sourceOutputs: Array<{
    txid: string;
    vout: number;
    satoshis: number;
    tokenCategory?: string;
    tokenAmount?: number | string;
    tokenNftCapability?: 'none' | 'mutable' | 'minting';
    tokenNftCommitment?: string;
  }>;
  requiredSignatures: string[];
  wcTransaction: WcTransactionObject;
}

export class PaymentFundingService {
  private provider: ElectrumNetworkProvider;
  private network: 'mainnet' | 'testnet3' | 'testnet4' | 'chipnet';

  constructor(network: 'mainnet' | 'testnet3' | 'testnet4' | 'chipnet' = 'chipnet') {
    this.network = network;
    this.provider = new ElectrumNetworkProvider(network);
  }

  async buildFundingTransaction(params: FundingTransactionParams): Promise<UnsignedFundingTransaction> {
    const {
      contractAddress,
      senderAddress,
      amount,
      tokenType,
      tokenCategory,
      nftCommitment,
      nftCapability,
    } = params;

    // Get UTXOs for sender
    const utxos = await this.provider.getUtxos(senderAddress);

    if (!utxos || utxos.length === 0) {
      throw new Error(`No UTXOs found for address ${senderAddress}`);
    }

    let selectedUtxos: typeof utxos = [];
    let totalInputValue = 0n;
    let totalTokenInputAmount = 0n;
    const dustAmount = getTokenOutputDustSatoshis();
    const amountOnChain = toNonNegativeBigInt(amount, 'amount');
    let stateTokenCategory: string | undefined = tokenCategory;

    if (tokenType === 'FUNGIBLE_TOKEN') {
      if (!tokenCategory) {
        throw new Error('Token category required for FUNGIBLE_TOKEN type');
      }
      stateTokenCategory = tokenCategory;

      const tokenUtxos = utxos.filter(
        (utxo: any) =>
          utxo.token?.category === tokenCategory &&
          utxo.token?.amount &&
          !utxo.token?.nft
      );

      if (tokenUtxos.length === 0) {
        throw new Error(`No fungible token UTXOs found for category ${tokenCategory}`);
      }

      let totalTokenAmount = 0n;
      for (const utxo of tokenUtxos) {
        const tokenAmount = toNonNegativeBigInt(utxo.token?.amount ?? 0n, 'token input amount');
        totalTokenAmount += tokenAmount;
        totalTokenInputAmount += tokenAmount;
        totalInputValue += toNonNegativeBigInt(utxo.satoshis, 'input satoshis');
        selectedUtxos.push(utxo);

        if (totalTokenAmount >= amountOnChain) {
          break;
        }
      }

      if (totalTokenAmount < amountOnChain) {
        throw new Error(
          `Insufficient token balance. Required: ${amountOnChain.toString()}, Available: ${totalTokenAmount.toString()}`
        );
      }

      const bchUtxos = utxos.filter((utxo: any) => !utxo.token);
      if (bchUtxos.length > 0) {
        selectedUtxos.push(bchUtxos[0]);
        totalInputValue += toNonNegativeBigInt(bchUtxos[0].satoshis, 'fee input satoshis');
      }
    } else {
      const nonTokenUtxos = utxos.filter((utxo: any) => !utxo.token);
      const categoryAnchor = nonTokenUtxos.find((utxo: any) => utxo.vout === 0);
      if (!categoryAnchor) {
        throw new Error(
          'Cannot mint payment state NFT: sender wallet needs a spendable BCH UTXO with outpoint index 0',
        );
      }
      stateTokenCategory = categoryAnchor.txid;

      const requiredAmount = amountOnChain + 2000n;

      const orderedUtxos = [
        categoryAnchor,
        ...nonTokenUtxos.filter(
          (utxo: any) => utxo.txid !== categoryAnchor.txid || utxo.vout !== categoryAnchor.vout,
        ),
      ];

      for (const utxo of orderedUtxos) {
        selectedUtxos.push(utxo);
        totalInputValue += toNonNegativeBigInt(utxo.satoshis, 'input satoshis');

        if (totalInputValue >= requiredAmount) {
          break;
        }
      }

      if (totalInputValue < requiredAmount) {
        throw new Error(
          `Insufficient BCH balance. Required: ${requiredAmount.toString()} sats, ` +
          `Available: ${totalInputValue.toString()} sats`
        );
      }
    }

    const sourceOutputs = selectedUtxos.map((utxo: any) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      satoshis: Number(toNonNegativeBigInt(utxo.satoshis, 'source output satoshis')),
      tokenCategory: utxo.token?.category,
      tokenAmount: utxo.token?.amount !== undefined ? toNonNegativeBigInt(utxo.token.amount, 'source token amount').toString() : undefined,
      tokenNftCapability: utxo.token?.nft?.capability,
      tokenNftCommitment: utxo.token?.nft?.commitment,
    }));

    const tokenChangeAmount =
      tokenType === 'FUNGIBLE_TOKEN' && totalTokenInputAmount > amountOnChain
        ? totalTokenInputAmount - amountOnChain
        : 0n;
    const estimatedOutputCount = tokenChangeAmount > 0n ? 3 : 2;
    const estimatedFee = this.estimateFee(selectedUtxos.length, estimatedOutputCount);
    const tokenContractSatoshis = getTokenFundingSatoshis('payment');
    const contractOutput = tokenType === 'FUNGIBLE_TOKEN' ? tokenContractSatoshis : amountOnChain;
    const bchBudgetAfterContractAndFee = totalInputValue - contractOutput - estimatedFee;
    const bchBudgetAfterTokenChange =
      tokenChangeAmount > 0n ? bchBudgetAfterContractAndFee - dustAmount : bchBudgetAfterContractAndFee;

    if (bchBudgetAfterTokenChange < 0n) {
      throw new Error(
        'Insufficient BCH balance to cover outputs and fees for token funding transaction'
      );
    }

    if (!stateTokenCategory) {
      throw new Error('Missing state token category for payment funding output');
    }

    const outputs: TransactionOutput[] = [
      {
        to: contractAddress,
        amount: contractOutput.toString(),
        token: tokenType === 'FUNGIBLE_TOKEN'
          ? {
              category: tokenCategory!,
              amount: amountOnChain.toString(),
              nft: {
                commitment: nftCommitment,
                capability: nftCapability,
              },
            }
          : {
              category: stateTokenCategory,
              amount: 0,
              nft: {
                commitment: nftCommitment,
                capability: nftCapability,
              },
            },
      },
    ];

    if (tokenChangeAmount > 0n) {
      outputs.push({
        to: senderAddress,
        amount: dustAmount.toString(),
        token: {
          category: tokenCategory!,
          amount: tokenChangeAmount.toString(),
        },
      });
    }

    if (bchBudgetAfterTokenChange > 546n) {
      outputs.push({
        to: senderAddress,
        amount: bchBudgetAfterTokenChange.toString(),
      });
    }

    const wcTransaction = buildFundingWcTransaction({
      inputOwnerAddress: senderAddress,
      inputs: sourceOutputs,
      outputs,
      userPrompt: `Fund recurring payment contract ${contractAddress}`,
      broadcast: true,
    });

    return {
      inputs: sourceOutputs,
      outputs,
      fee: Number(estimatedFee),
      txHex: JSON.stringify({ inputs: sourceOutputs, outputs, fee: estimatedFee.toString() }),
      sourceOutputs,
      requiredSignatures: [senderAddress],
      wcTransaction,
    };
  }

  estimateFee(numInputs: number, numOutputs: number): bigint {
    const estimatedSize = numInputs * 148 + numOutputs * 34 + 10;
    const feeRate = 1n;
    return BigInt(estimatedSize) * feeRate;
  }
}
