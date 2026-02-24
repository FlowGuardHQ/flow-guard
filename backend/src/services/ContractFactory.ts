import { Artifact } from 'cashscript';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Artifacts root relative to this file: backend/src/services → ../../../contracts/artifacts
const ARTIFACTS_ROOT = join(__dirname, '../../../contracts/artifacts');

export interface ConstructorParam {
  type: 'bigint' | 'bytes' | 'string' | 'boolean';
  value: string; // hex for bytes, string representation for others
}

export type ContractType =
  | 'VaultCovenant'
  | 'ProposalCovenant'
  | 'VestingCovenant'
  | 'RecurringPaymentCovenant'
  | 'AirdropCovenant'
  | 'RewardCovenant'
  | 'BountyCovenant'
  | 'GrantCovenant'
  | 'VoteLockCovenant'
  | 'TallyCommitment_FixedMax'
  | 'TallyCommitment_Attested';

const CONTRACT_CATEGORY: Record<ContractType, string> = {
  VaultCovenant: 'treasury',
  ProposalCovenant: 'treasury',
  VestingCovenant: 'streaming',
  RecurringPaymentCovenant: 'streaming',
  AirdropCovenant: 'distribution',
  RewardCovenant: 'distribution',
  BountyCovenant: 'distribution',
  GrantCovenant: 'distribution',
  VoteLockCovenant: 'governance',
  TallyCommitment_FixedMax: 'governance',
  TallyCommitment_Attested: 'governance',
};

export class ContractFactory {
  private static cache: Partial<Record<ContractType, Artifact>> = {};

  static getArtifact(type: ContractType): Artifact {
    if (this.cache[type]) return this.cache[type]!;

    const category = CONTRACT_CATEGORY[type];
    const path = join(ARTIFACTS_ROOT, category, `${type}.json`);

    try {
      const artifact = JSON.parse(readFileSync(path, 'utf-8')) as Artifact;
      this.cache[type] = artifact;
      return artifact;
    } catch (error) {
      throw new Error(`Failed to load artifact ${type} from ${path}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
