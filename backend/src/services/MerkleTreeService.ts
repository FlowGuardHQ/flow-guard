/**
 * Merkle Tree Service
 * Generates merkle trees and proofs for airdrop campaigns
 */

import { hash256, binToHex, hexToBin } from '@bitauth/libauth';

export interface AirdropRecipient {
  address: string; // BCH address
  amount: number; // Amount to receive
}

export interface MerkleTree {
  root: string; // hex-encoded 32-byte root hash
  leaves: string[]; // hex-encoded leaf hashes
  proofs: Map<string, string[]>; // address -> merkle proof (array of hashes)
}

export class MerkleTreeService {
  /**
   * Hash a leaf (recipient address + amount)
   */
  private hashLeaf(address: string, amount: number): Uint8Array {
    // Leaf format: hash256(address + amount)
    const addressBytes = new TextEncoder().encode(address);
    const amountBytes = new Uint8Array(8);
    new DataView(amountBytes.buffer).setBigUint64(0, BigInt(amount), true);

    const combined = new Uint8Array(addressBytes.length + amountBytes.length);
    combined.set(addressBytes, 0);
    combined.set(amountBytes, addressBytes.length);

    return hash256(combined);
  }

  /**
   * Hash two nodes together
   */
  private hashPair(left: Uint8Array, right: Uint8Array): Uint8Array {
    // Sort hashes to make tree deterministic
    const [a, b] = binToHex(left) < binToHex(right) ? [left, right] : [right, left];

    const combined = new Uint8Array(64);
    combined.set(a, 0);
    combined.set(b, 32);

    return hash256(combined);
  }

  /**
   * Generate merkle tree from recipients list
   */
  generateMerkleTree(recipients: AirdropRecipient[]): MerkleTree {
    if (recipients.length === 0) {
      throw new Error('Recipients list cannot be empty');
    }

    // Generate leaf hashes
    const leaves = recipients.map(r => this.hashLeaf(r.address, r.amount));
    const leafHexes = leaves.map(l => binToHex(l));

    // Build tree bottom-up
    let currentLevel = [...leaves];
    const tree: Uint8Array[][] = [currentLevel];

    while (currentLevel.length > 1) {
      const nextLevel: Uint8Array[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          // Hash pair
          nextLevel.push(this.hashPair(currentLevel[i], currentLevel[i + 1]));
        } else {
          // Odd number of nodes, promote last node
          nextLevel.push(currentLevel[i]);
        }
      }

      tree.push(nextLevel);
      currentLevel = nextLevel;
    }

    const root = currentLevel[0];

    // Generate proofs for each recipient
    const proofs = new Map<string, string[]>();

    for (let i = 0; i < recipients.length; i++) {
      const proof = this.generateProof(tree, i);
      proofs.set(recipients[i].address, proof.map(p => binToHex(p)));
    }

    return {
      root: binToHex(root),
      leaves: leafHexes,
      proofs,
    };
  }

  /**
   * Generate merkle proof for a specific leaf index
   */
  private generateProof(tree: Uint8Array[][], leafIndex: number): Uint8Array[] {
    const proof: Uint8Array[] = [];
    let index = leafIndex;

    for (let level = 0; level < tree.length - 1; level++) {
      const currentLevel = tree[level];
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;

      if (siblingIndex < currentLevel.length) {
        proof.push(currentLevel[siblingIndex]);
      }

      index = Math.floor(index / 2);
    }

    return proof;
  }

  /**
   * Verify a merkle proof
   */
  verifyProof(
    address: string,
    amount: number,
    proof: string[],
    root: string
  ): boolean {
    let hash = this.hashLeaf(address, amount);

    for (const proofElement of proof) {
      const proofHash = hexToBin(proofElement);
      hash = this.hashPair(hash, proofHash);
    }

    return binToHex(hash) === root;
  }

  /**
   * Get proof for a specific address
   */
  getProof(tree: MerkleTree, address: string): string[] | undefined {
    return tree.proofs.get(address);
  }
}
