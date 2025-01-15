import { z } from 'zod';
import { LIT_NETWORK } from '@lit-protocol/constants';

/**
 * Represents the supported Lit networks for the tool.
 * @typedef {string} SupportedLitNetwork
 * @description Can be one of the following:
 * - `LIT_NETWORK.DatilDev` (development environment)
 * - `LIT_NETWORK.DatilTest` (testing environment)
 * - `LIT_NETWORK.Datil` (production environment)
 */
export type SupportedLitNetwork =
  | (typeof LIT_NETWORK)['DatilDev']
  | (typeof LIT_NETWORK)['DatilTest']
  | (typeof LIT_NETWORK)['Datil'];

/**
 * Represents the configuration for a specific network in the ERC20Transfer tool.
 * @typedef {Object} NetworkConfig
 * @property {string} litNetwork - The Lit network identifier (e.g., 'datil-dev', 'datil-test', 'datil').
 * @property {string} ipfsCid - The IPFS CID (Content Identifier) associated with the network configuration.
 */
export interface NetworkConfig {
  litNetwork: string;
  ipfsCid: string;
}

/**
 * Network-specific configurations for the ERC20Transfer tool.
 * @type {Record<string, NetworkConfig>}
 * @description A mapping of network names to their respective configurations.
 */
export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  'datil-dev': {
    litNetwork: 'datil-dev', // Lit network identifier for the development environment
    ipfsCid: '', // IPFS CID for the development environment (to be populated if needed)
  },
  'datil-test': {
    litNetwork: 'datil-test', // Lit network identifier for the testing environment
    ipfsCid: '', // IPFS CID for the testing environment (to be populated if needed)
  },
  datil: {
    litNetwork: 'datil', // Lit network identifier for the production environment
    ipfsCid: '', // IPFS CID for the production environment (to be populated if needed)
  },
};

/**
 * Zod schema for validating Ethereum addresses.
 * @type {z.ZodString}
 * @description Ensures the address is a valid Ethereum address (0x followed by 40 hexadecimal characters).
 */
export const BaseEthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format');

/**
 * Represents a validated Ethereum address.
 * @typedef {z.infer<typeof BaseEthereumAddressSchema>} EthereumAddress
 */
export type EthereumAddress = z.infer<typeof BaseEthereumAddressSchema>;

/**
 * Represents a generic AW (Function-as-a-Service) tool.
 * @template TParams - The type of the tool's parameters.
 * @template TPolicy - The type of the tool's policy.
 * @description A tool that can be configured with parameters and policies for execution.
 */
export interface AwTool<
  TParams extends Record<string, any> = Record<string, any>,
  TPolicy extends { type: string } = { type: string }
> {
  // Basic tool information
  name: string; // The name of the tool
  description: string; // A description of the tool's functionality
  ipfsCid: string; // The IPFS CID for the tool's Lit Action
  chain: string; // The chain the tool is deployed on NOTE: currently only 'ethereum' and 'solana' will be supported

  // Parameter handling
  parameters: {
    type: TParams; // Placeholder for the parameter type
    schema: z.ZodType<TParams>; // Zod schema for validating parameters
    descriptions: Readonly<Record<keyof TParams, string>>; // Descriptions of each parameter
    validate: (
      params: unknown
    ) => true | Array<{ param: string; error: string }>; // Function to validate parameters
  };

  // Policy handling
  policy: {
    type: TPolicy; // Placeholder for the policy type
    version: string; // The version of the policy
    schema: z.ZodType<TPolicy>; // Zod schema for validating policies
    encode: (policy: TPolicy) => string; // Function to encode a policy into a string
    decode: (encodedPolicy: string) => TPolicy; // Function to decode a string into a policy
  };
}
