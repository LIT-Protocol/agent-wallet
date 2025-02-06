import { z } from 'zod';
import { ethers } from 'ethers';
import { BaseEthereumAddressSchema } from '@lit-protocol/aw-tool';

/**
 * Schema for validating a Enso policy.
 * Ensures the policy has the correct structure and valid values.
 */
const policySchema = z.object({
  /** The type of policy, must be `Enso`. */
  type: z.literal('Enso'),

  /** The version of the policy. */
  version: z.string(),

  allowedTokens: z.array(BaseEthereumAddressSchema),
});

/**
 * Encodes a Enso policy into a format suitable for on-chain storage.
 * @param policy - The Enso policy to encode.
 * @returns The encoded policy as a hex string.
 * @throws If the policy does not conform to the schema.
 */
function encodePolicy(policy: EnsoPolicyType): string {
  // Validate the policy against the schema
  policySchema.parse(policy);

  return ethers.utils.defaultAbiCoder.encode(
    ['tuple(address[] allowedTokens)'],
    [{ allowedTokens: policy.allowedTokens }]
  );
}

/**
 * Decodes a Enso policy from its on-chain encoded format.
 * @param encodedPolicy - The encoded policy as a hex string.
 * @returns The decoded Enso policy.
 * @throws If the encoded policy is invalid or does not conform to the schema.
 */
function decodePolicy(encodedPolicy: string): EnsoPolicyType {
  const decoded = ethers.utils.defaultAbiCoder.decode(
    ['tuple(address[] allowedTokens)'],
    encodedPolicy
  )[0];

  const policy: EnsoPolicyType = {
    type: 'Enso',
    version: '1.0.0',
    allowedTokens: decoded.allowedTokens,
  };

  return policySchema.parse(policy);
}

/**
 * Represents the type of a Enso policy, inferred from the schema.
 */
export type EnsoPolicyType = z.infer<typeof policySchema>;

/**
 * Utility object for working with Enso policies.
 * Includes the schema, encoding, and decoding functions.
 */
export const EnsoPolicy = {
  /** The type of the policy. */
  type: {} as EnsoPolicyType,

  /** The version of the policy. */
  version: '1.0.0',

  /** The schema for validating Enso policies. */
  schema: policySchema,

  /** Encodes a Enso policy into a format suitable for on-chain storage. */
  encode: encodePolicy,

  /** Decodes a Enso policy from its on-chain encoded format. */
  decode: decodePolicy,
};

