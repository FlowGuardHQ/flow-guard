import { hexToBin, cashAddressToLockingBytecode } from '@bitauth/libauth';
import { ContractService, VaultParams } from './contract-service.js';

export interface SpendTxParams {
  // Vault contract params (to reconstruct contract)
  vaultParams: VaultParams & { vaultId: string };
  // Spend details
  recipientAddress: string;
  payoutAmountSatoshis: number;
  proposalIdHex: string; // 32-byte hex
  // Current on-chain state (from NFT commitment)
  newPeriodId: number;
  newSpent: number;
  // Two signers providing signatures
  signer1Pubkey: string;
  signer2Pubkey: string;
}

export interface UnsignedTransaction {
  contractAddress: string;
  functionName: string;
  functionInputs: Record<string, unknown>;
  outputs: Array<{ address: string; satoshis: bigint }>;
  fee: bigint;
}

const DEFAULT_FEE_SATOSHIS = BigInt(2000);

export class TransactionBuilder {
  private contractService: ContractService;

  constructor(network: 'mainnet' | 'testnet3' | 'testnet4' | 'chipnet' = 'chipnet') {
    this.contractService = new ContractService(network);
  }

  /**
   * Deploy a new vault and return its on-chain address.
   * Wraps ContractService.deployVault with a clean interface.
   */
  async getVaultAddress(params: VaultParams): Promise<{ address: string; vaultId: string; bytecode: string }> {
    const result = await this.contractService.deployVault(params);
    return {
      address: result.contractAddress,
      vaultId: result.contractId,
      bytecode: result.bytecode,
    };
  }

  /**
   * Validate spend parameters against vault guardrails.
   * Throws if any guardrail is violated.
   */
  validateSpend(params: SpendTxParams): void {
    const { vaultParams, payoutAmountSatoshis, recipientAddress } = params;

    if (vaultParams.periodCap > 0 && payoutAmountSatoshis > vaultParams.periodCap) {
      throw new Error(
        `Payout ${payoutAmountSatoshis} satoshis exceeds period cap of ${vaultParams.periodCap} satoshis`
      );
    }

    if (vaultParams.recipientCap > 0 && payoutAmountSatoshis > vaultParams.recipientCap) {
      throw new Error(
        `Payout ${payoutAmountSatoshis} satoshis exceeds recipient cap of ${vaultParams.recipientCap} satoshis`
      );
    }

    if (vaultParams.allowlistEnabled && vaultParams.allowedAddresses?.length) {
      const normalized = recipientAddress.toLowerCase();
      const inAllowlist = vaultParams.allowedAddresses.some(
        (addr) => addr.toLowerCase() === normalized
      );
      if (!inAllowlist) {
        throw new Error(`Recipient ${recipientAddress} is not in the vault allowlist`);
      }
    }
  }

  /**
   * Build a spend() transaction descriptor.
   * Returns the parameters needed for the frontend to build + sign the transaction
   * using CashScript SDK on the client side.
   *
   * Client-side signing flow (CashScript 0.13):
   * 1. Backend calls buildSpendDescriptor → returns this descriptor
   * 2. Frontend instantiates Contract with same params
   * 3. Frontend calls contract.unlock.spend(sig1, pk1, sig2, pk2, ...)
   * 4. Frontend creates TransactionBuilder, addInput + addOutput, .build()
   * 5. Frontend broadcasts via POST /api/proposals/broadcast
   */
  buildSpendDescriptor(params: SpendTxParams): UnsignedTransaction {
    this.validateSpend(params);

    const { vaultParams, recipientAddress, payoutAmountSatoshis, proposalIdHex, newPeriodId, newSpent, signer1Pubkey, signer2Pubkey } = params;

    const recipientHash = this.addressToHash160Hex(recipientAddress);
    const fee = this.estimateFee(1, 2);

    return {
      contractAddress: '', // Filled by frontend after contract instantiation
      functionName: 'spend',
      functionInputs: {
        proposalId: proposalIdHex,
        recipientHash,
        payoutAmount: payoutAmountSatoshis,
        newPeriodId,
        newSpent,
        signer1Pubkey,
        signer2Pubkey,
      },
      outputs: [
        { address: recipientAddress, satoshis: BigInt(payoutAmountSatoshis) },
      ],
      fee,
    };
  }

  /**
   * Extract hash160 hex from a BCH cashaddr
   */
  private addressToHash160Hex(address: string): string {
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
      throw new Error(`Vault payouts require P2PKH addresses: ${address}`);
    }
    return Buffer.from(b.slice(3, 23)).toString('hex');
  }

  /**
   * Estimate transaction fee based on input/output count
   * Approximate: 1 input + 2 outputs ≈ 300 bytes → 1000–2000 sat at 1 sat/byte
   */
  estimateFee(inputCount: number, outputCount: number): bigint {
    const estimatedBytes = inputCount * 150 + outputCount * 34 + 100;
    return BigInt(Math.ceil(estimatedBytes * 1.5)); // 1.5 sat/byte buffer
  }
}
