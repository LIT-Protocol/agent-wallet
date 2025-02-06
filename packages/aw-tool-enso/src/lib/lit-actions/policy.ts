import {
  checkLitAuthAddressIsDelegatee,
  getPkpToolRegistryContract,
  getPolicyParameters,
} from '@lit-protocol/aw-tool';
import { getAddress } from 'ethers/lib/utils';

declare global {
  // Required Inputs
  const parentToolIpfsCid: string;
  const pkpToolRegistryContractAddress: string;
  const pkpTokenId: string;
  const delegateeAddress: string;
  const toolParameters: {
    amountIn: string;
    tokenIn: string;
    tokenOut: string;
  };
}

(async () => {
  const pkpToolRegistryContract = await getPkpToolRegistryContract(
    pkpToolRegistryContractAddress
  );

  const isDelegatee = await checkLitAuthAddressIsDelegatee(
    pkpToolRegistryContract,
    pkpTokenId
  );
  if (!isDelegatee) {
    throw new Error(
      `Session signer ${ethers.utils.getAddress(
        LitAuth.authSigAddress
      )} is not a delegatee for PKP ${pkpTokenId}`
    );
  }

  // Get policy parameters
  const policyParameters = await getPolicyParameters(
    pkpToolRegistryContract,
    pkpTokenId,
    parentToolIpfsCid,
    delegateeAddress,
    ['allowedTokens']
  );

  let allowedTokens: string[] = [];
  // Add your policy validation logic here using policyParameters
  for (const parameter of policyParameters) {
    const value = ethers.utils.toUtf8String(parameter.value);
    allowedTokens = JSON.parse(value).map(getAddress);
    console.log(`Formatted allowedTokens: ${allowedTokens.join(', ')}`);
  }

  if (allowedTokens.length > 0) {
    console.log(`Checking if ${toolParameters.tokenIn} is an allowed token...`);
    if (!allowedTokens.includes(getAddress(toolParameters.tokenIn))) {
      throw new Error(
        `Token ${
          toolParameters.tokenIn
        } not allowed. Allowed tokens: ${allowedTokens.join(', ')}`
      );
    }

    console.log(
      `Checking if ${toolParameters.tokenOut} is an allowed token...`
    );
    if (!allowedTokens.includes(getAddress(toolParameters.tokenOut))) {
      throw new Error(
        `Token ${
          toolParameters.tokenOut
        } not allowed. Allowed tokens: ${allowedTokens.join(', ')}`
      );
    }
  }
})();

