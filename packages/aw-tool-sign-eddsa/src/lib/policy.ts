import { z } from 'zod';
import { ethers } from 'ethers';

/**
 * Schema for validating a SignEddsa policy.
 * Ensures the policy has the correct structure and valid values.
 */
const policySchema = z.object({
  /** The type of policy, must be `SignEddsa`. */
  type: z.literal('SignEddsa'),

  /** The version of the policy. */
  version: z.string(),

  /** An array of allowed message prefixes. */
  allowedPrefixes: z.array(z.string()),
});

/**
 * Encodes a SignEddsa policy into a format suitable for on-chain storage.
 * @param policy - The SignEddsa policy to encode.
 * @returns The encoded policy as a hex string.
 * @throws If the policy does not conform to the schema.
 */
function encodePolicy(policy: SignEddsaPolicyType): string {
  // Validate the policy against the schema
  policySchema.parse(policy);

  // Encode the policy using ABI encoding
  return ethers.utils.defaultAbiCoder.encode(
    ['tuple(string[] allowedPrefixes)'],
    [
      {
        allowedPrefixes: policy.allowedPrefixes,
      },
    ]
  );
}

/**
 * Decodes a SignEddsa policy from its on-chain encoded format.
 * @param encodedPolicy - The encoded policy as a hex string.
 * @returns The decoded SignEddsa policy.
 * @throws If the encoded policy is invalid or does not conform to the schema.
 */
function decodePolicy(encodedPolicy: string): SignEddsaPolicyType {
  // Decode the policy using ABI decoding
  const decoded = ethers.utils.defaultAbiCoder.decode(
    ['tuple(string[] allowedPrefixes)'],
    encodedPolicy
  )[0];

  // Construct the policy object
  const policy: SignEddsaPolicyType = {
    type: 'SignEddsa',
    version: '1.0.0',
    allowedPrefixes: decoded.allowedPrefixes,
  };

  // Validate the decoded policy against the schema
  return policySchema.parse(policy);
}

/**
 * Represents the type of a SignEddsa policy, inferred from the schema.
 */
export type SignEddsaPolicyType = z.infer<typeof policySchema>;

/**
 * Utility object for working with SignEddsa policies.
 * Includes the schema, encoding, and decoding functions.
 */
export const SignEddsaPolicy = {
  /** The type of the policy. */
  type: {} as SignEddsaPolicyType,

  /** The version of the policy. */
  version: '1.0.0',

  /** The schema for validating SignEddsa policies. */
  schema: policySchema,

  /** Encodes a SignEddsa policy into a format suitable for on-chain storage. */
  encode: encodePolicy,

  /** Decodes a SignEddsa policy from its on-chain encoded format. */
  decode: decodePolicy,
};
