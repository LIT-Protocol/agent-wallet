import { z } from 'zod';
import {
  type AwTool,
  type SupportedLitNetwork,
  NETWORK_CONFIGS,
  NetworkConfig,
} from '@lit-protocol/aw-tool';

import { SignEddsaPolicy, type SignEddsaPolicyType } from './policy';
import { IPFS_CIDS } from './ipfs';

/**
 * Parameters required for the Signing EDDSA Lit Action.
 * @property {string} pkpEthAddress - The Ethereum address of the PKP.
 * @property message - The message to sign.
 */
export interface SignEddsaLitActionParameters {
  pkpEthAddress: string;
  message: string;
}

/**
 * Zod schema for validating `SignEddsaLitActionParameters`.
 * Ensures that the message is a valid string.
 */
const SignEddsaLitActionSchema = z.object({
  pkpEthAddress: z
    .string()
    .regex(
      /^0x[a-fA-F0-9]{40}$/,
      'Must be a valid Ethereum address (0x followed by 40 hexadecimal characters)'
    ),
  message: z.string(),
});

/**
 * Descriptions of each parameter for the Signing EDDSA Lit Action.
 * These descriptions are designed to be consumed by LLMs (Language Learning Models) to understand the required parameters.
 */
const SignEddsaLitActionParameterDescriptions = {
  pkpEthAddress:
    'The Ethereum address of the PKP that will be used to sign the message.',
  message: 'The message you want to sign.',
} as const;

/**
 * Validates the parameters for the Signing EDDSA Lit Action.
 * @param params - The parameters to validate.
 * @returns `true` if the parameters are valid, or an array of errors if invalid.
 */
const validateSignEddsaParameters = (
  params: unknown
): true | Array<{ param: string; error: string }> => {
  const result = SignEddsaLitActionSchema.safeParse(params);
  if (result.success) {
    return true;
  }

  // Map validation errors to a more user-friendly format
  return result.error.issues.map((issue) => ({
    param: issue.path[0] as string,
    error: issue.message,
  }));
};

/**
 * Creates a network-specific SignEddsa tool.
 * @param network - The supported Lit network (e.g., `datil-dev`, `datil-test`, `datil`).
 * @param config - The network configuration.
 * @returns A configured `AwTool` instance for the Signing EDDSA Lit Action.
 */
const createNetworkTool = (
  network: SupportedLitNetwork,
  config: NetworkConfig
): AwTool<SignEddsaLitActionParameters, SignEddsaPolicyType> => ({
  name: 'SignEddsa',
  description: `A Lit Action that signs a message with an allowlist of message prefixes.`,
  ipfsCid: IPFS_CIDS[network],
  chain: 'solana',
  parameters: {
    type: {} as SignEddsaLitActionParameters,
    schema: SignEddsaLitActionSchema,
    descriptions: SignEddsaLitActionParameterDescriptions,
    validate: validateSignEddsaParameters,
  },
  policy: SignEddsaPolicy,
});

/**
 * Exports network-specific SignEddsa tools.
 * Each tool is configured for a specific Lit network (e.g., `datil-dev`, `datil-test`, `datil`).
 */
export const SignEddsa = Object.entries(NETWORK_CONFIGS).reduce(
  (acc, [network, config]) => ({
    ...acc,
    [network]: createNetworkTool(network as SupportedLitNetwork, config),
  }),
  {} as Record<
    SupportedLitNetwork,
    AwTool<SignEddsaLitActionParameters, SignEddsaPolicyType>
  >
);
