import { LIT_RPC } from '@lit-protocol/constants';
import { ethers } from 'ethers';

import { PKP_TOOL_REGISTRY_ABI } from './human-readable-abi';

/**
 * Configuration for the Tool Policy Registry contract.
 * Includes the RPC URL and contract address for interacting with the registry.
 */
export interface ToolRegistryConfig {
  /** The RPC URL for the blockchain network. */
  rpcUrl: string;

  /** The address of the Tool Policy Registry contract. */
  contractAddress: string;
}

export const DEFAULT_REGISTRY_CONFIG: Record<string, ToolRegistryConfig> = {
  'datil-dev': {
    rpcUrl: LIT_RPC.CHRONICLE_YELLOWSTONE,
    contractAddress: '0x2707eabb60D262024F8738455811a338B0ECd3EC',
  },
  'datil-test': {
    rpcUrl: LIT_RPC.CHRONICLE_YELLOWSTONE,
    contractAddress: '0x525bF2bEb622D7C05E979a8b3fFcDBBEF944450E',
  },
  datil: {
    rpcUrl: LIT_RPC.CHRONICLE_YELLOWSTONE,
    contractAddress: '0xBDEd44A02b64416C831A0D82a630488A854ab4b1',
  },
} as const;

/**
 * Creates a new instance of the PKP Tool Registry contract.
 * @param config - The configuration for the Tool Policy Registry contract, includes the RPC URL and contract address.
 * @param signer - An optional ethers.Signer instance for write operations.
 * @returns A new instance of the PKP Tool Registry contract.
 */
export const getPkpToolRegistryContract = (
  { rpcUrl, contractAddress }: ToolRegistryConfig,
  signer?: ethers.Signer
) => {
  const contract = new ethers.Contract(
    contractAddress,
    PKP_TOOL_REGISTRY_ABI,
    new ethers.providers.JsonRpcProvider(rpcUrl)
  );

  // Connect the signer to allow write operations
  return signer ? contract.connect(signer) : contract;
};
