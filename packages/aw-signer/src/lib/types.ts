import { LIT_NETWORK } from '@lit-protocol/constants';
import { type AwTool } from '@lit-protocol/aw-tool';
import type { ethers } from 'ethers';
import { StoredKeyData } from '@lit-protocol/wrapped-keys';

/**
 * Represents the Lit network environment.
 * Can be one of the predefined Lit network types: `DatilDev`, `DatilTest`, or `Datil`.
 */
export type LitNetwork =
  | (typeof LIT_NETWORK)['DatilDev']
  | (typeof LIT_NETWORK)['DatilTest']
  | (typeof LIT_NETWORK)['Datil'];

/**
 * Configuration for the Tool Policy Registry contract.
 * Includes the RPC URL and contract address for interacting with the registry.
 */
export interface ToolPolicyRegistryConfig {
  /** The RPC URL for the blockchain network. */
  rpcUrl: string;

  /** The address of the Tool Policy Registry contract. */
  contractAddress: string;
}

/**
 * Configuration for the agent (Admin or Delegatee).
 * Includes optional settings for the Lit network, debug mode, and Tool Policy Registry.
 */
export interface AgentConfig {
  /** The Lit network to use (e.g., `DatilDev`, `DatilTest`, `Datil`). */
  litNetwork?: LitNetwork;

  /** Whether to enable debug mode for additional logging. */
  debug?: boolean;
}

/**
 * Configuration for an Admin using an Externally Owned Account (EOA).
 * Includes the type (`eoa`) and an optional private key.
 */
interface EoaAdminConfig {
  /** The type of Admin configuration (`eoa` for Externally Owned Account). */
  type: 'eoa';

  /** The private key for the Admin's EOA. */
  privateKey?: string;
}

/**
 * Configuration for an Admin using a Multisig wallet.
 * Includes the type (`multisig`), the multisig contract address, and its ABI.
 */
interface MultisigAdminConfig {
  /** The type of Admin configuration (`multisig` for Multisig wallet). */
  type: 'multisig';

  /** The address of the multisig contract. */
  address: string;

  /** The ABI (Application Binary Interface) of the multisig contract. */
  abi: string;
}

/**
 * Represents the configuration for an Admin.
 * Can be either an EOA (Externally Owned Account) or a Multisig wallet.
 */
export type AdminConfig = EoaAdminConfig | MultisigAdminConfig;

/**
 * Represents information about a PKP (Programmable Key Pair).
 * Includes the token ID, public key, Ethereum address, and transaction details for minting.
 */
export interface PkpInfo {
  info: {
    /** The token ID of the PKP. */
    tokenId: string;

    /** The public key of the PKP. */
    publicKey: string;

    /** The Ethereum address derived from the PKP's public key. */
    ethAddress: string;
  };

  /** The transaction object for minting the PKP. */
  mintTx: ethers.ContractTransaction;

  /** The transaction receipt for minting the PKP. */
  mintReceipt: ethers.ContractReceipt;
}

/**
 * Represents information about a Capacity Credit.
 * Includes the capacity token ID, requests per kilosecond, expiration details, and minting timestamp.
 */
export interface CapacityCreditInfo {
  /** The capacity token ID as a string. */
  capacityTokenIdStr: string;

  /** The capacity token ID as a number. */
  capacityTokenId: string;

  /** The number of requests allowed per kilosecond. */
  requestsPerKilosecond: number;

  /** The number of days until the capacity credit expires at UTC midnight. */
  daysUntilUTCMidnightExpiration: number;

  /** The timestamp when the capacity credit was minted (in UTC). */
  mintedAtUtc: string;
}

/**
 * Options for creating a Capacity Credit delegation auth signature.
 * Includes delegatee addresses, usage limits, and expiration.
 */
export interface CapacityCreditDelegationAuthSigOptions {
  /** The addresses of the delegatees. */
  delegateeAddresses: string[];

  /** The number of uses allowed for the delegation (optional). */
  uses?: string;

  /** The expiration time for the delegation (optional). */
  expiration?: string;
}

/**
 * Options for minting a Capacity Credit.
 * Includes requests per kilosecond and expiration details.
 */
export interface CapacityCreditMintOptions {
  /** The number of requests allowed per kilosecond (optional). */
  requestsPerKilosecond?: number;

  /** The number of days until the capacity credit expires at UTC midnight (optional). */
  daysUntilUTCMidnightExpiration?: number;
}

export interface UnknownRegisteredToolWithPolicy {
  ipfsCid: string;

  /** The policy associated with the tool. */
  policy: string;

  /** The version of the tool. */
  version: string;
}

/**
 * Represents information about a delegated PKP (Programmable Key Pair).
 * Includes the token ID, Ethereum address, and public key.
 */
export interface DelegatedPkpInfo {
  /** The token ID of the delegated PKP. */
  tokenId: string;

  /** The Ethereum address derived from the PKP's public key. */
  ethAddress: string;

  /** The public key of the delegated PKP. */
  publicKey: string;
}

export interface IntentMatcherResponse<TParams extends Record<string, any>> {
  analysis: any;
  matchedTool: AwTool | null;
  params: {
    foundParams: Partial<TParams>;
    missingParams: Array<keyof TParams>;
    validationErrors?: Array<{ param: string; error: string }>;
  };
}

export interface IntentMatcher {
  analyzeIntentAndMatchTool(
    intent: string,
    registeredTools: AwTool<any, any>[]
  ): Promise<IntentMatcherResponse<any>>;
}

export interface CredentialStore {
  getCredentials<T>(requiredCredentialNames: readonly string[]): Promise<{
    foundCredentials: Partial<CredentialsFor<T>>;
    missingCredentials: string[];
  }>;
  setCredentials<T>(credentials: Partial<CredentialsFor<T>>): Promise<void>;
}

export type CredentialNames<T> = T extends {
  requiredCredentialNames: readonly (infer U extends string)[];
}
  ? U
  : never;

export type CredentialsFor<T> = {
  [K in CredentialNames<T>]: string;
};

export interface WrappedKeyInfo extends StoredKeyData {
  // Additional fields if needed
}
