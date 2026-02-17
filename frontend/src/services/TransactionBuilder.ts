/**
 * Frontend Transaction Builder
 * Converts backend transaction descriptors into Paytaca-compatible signing requests
 */

import type { CashScriptSignOptions, SourceOutput } from '../types/wallet';

export interface TransactionDescriptor {
  type: string;
  contractType: string;
  contractAddress?: string;
  functionName: string;
  functionInputs: Record<string, any>;
  signerPubkeys?: string[];
  requiredApprovals?: number;
  newState?: number;
  streamId?: string;
  vaultId?: string;
  proposalId?: number;
  cycleNumber?: number;
  unlockAmount?: number;
  recipientAddress?: string;
  claimAmount?: number;
  claimableAmount?: number;
}

export class TransactionBuilder {
  /**
   * Convert backend transaction descriptor to Paytaca signing options
   *
   * NOTE: This is a simplified implementation. Full implementation would:
   * 1. Fetch UTXOs from the contract address
   * 2. Build complete libauth transaction with inputs/outputs
   * 3. Encode to hex
   * 4. Prepare sourceOutputs with contract artifact
   *
   * For now, we'll use the backend API to build the full transaction.
   */
  static async buildSigningRequest(
    descriptor: TransactionDescriptor,
    contractArtifact?: any
  ): Promise<CashScriptSignOptions> {
    // For now, delegate to backend to build the complete transaction hex
    // Backend will use CashScript SDK to build the transaction
    const response = await fetch('/api/transactions/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        descriptor,
        artifact: contractArtifact,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to build transaction');
    }

    const { transaction, sourceOutputs } = await response.json();

    return {
      transaction,
      sourceOutputs,
      broadcast: true,
      userPrompt: this.generateUserPrompt(descriptor),
    };
  }

  /**
   * Generate user-friendly prompt for wallet confirmation
   */
  private static generateUserPrompt(descriptor: TransactionDescriptor): string {
    switch (descriptor.type) {
      case 'stream_claim':
        return `Claim ${descriptor.claimAmount?.toFixed(4)} BCH from stream ${descriptor.streamId}`;

      case 'stream_cancel':
        return `Cancel stream ${descriptor.streamId}`;

      case 'proposal_create':
        return `Create proposal in vault ${descriptor.vaultId}`;

      case 'proposal_approve':
        return `Approve proposal #${descriptor.proposalId}`;

      case 'proposal_execute':
        return `Execute proposal #${descriptor.proposalId} - Send ${(descriptor.functionInputs.amount / 100000000).toFixed(4)} BCH`;

      case 'cycle_unlock':
        return `Unlock cycle #${descriptor.cycleNumber} in vault ${descriptor.vaultId}`;

      default:
        return `Sign ${descriptor.type} transaction`;
    }
  }

  /**
   * Simple transaction building (for testing/development)
   * Builds a minimal transaction without full UTXO management
   *
   * PRODUCTION: Use buildSigningRequest() which delegates to backend
   */
  static buildSimpleTransaction(descriptor: TransactionDescriptor): {
    transaction: string;
    sourceOutputs: SourceOutput[];
  } {
    // This is a placeholder that returns mock data
    // Real implementation needs CashScript SDK + libauth on frontend
    throw new Error(
      'Simple transaction building not implemented. ' +
      'Use buildSigningRequest() to delegate to backend.'
    );
  }
}
