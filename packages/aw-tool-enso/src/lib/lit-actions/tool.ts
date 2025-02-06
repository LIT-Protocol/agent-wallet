import {
  fetchToolPolicyFromRegistry,
  getPkpInfo,
  getPkpToolRegistryContract,
  NETWORK_CONFIG,
} from '@lit-protocol/aw-tool';
import { ENSO_API_KEY, ENSO_ETH, ENSO_SUPPORTED_CHAINS } from '../../constants';
import { getToken } from './utils/get-token';
import { EnsoClient } from '@ensofinance/sdk';
import { parseUnits } from 'ethers/lib/utils';
import { getRoute } from './utils/get-route';
import { createApproveTx } from './utils/approve';
import { signTx } from './utils/sign-tx';
import { broadcastTransaction } from './utils/broadcast-tx';
import { getGasData } from './utils/get-gas-data';
import { createRouteTx } from './utils/create-route-tx';

declare global {
  // Required Inputs
  const params: {
    pkpEthAddress: string;
    chainId: string;
    rpcUrl: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
  };
}

(async () => {
  try {
    console.log(`Using Lit Network: ${LIT_NETWORK}`);
    console.log(
      `Using PKP Tool Registry Address: ${PKP_TOOL_REGISTRY_ADDRESS}`
    );
    console.log(
      `Using Pubkey Router Address: ${
        NETWORK_CONFIG[LIT_NETWORK as keyof typeof NETWORK_CONFIG]
          .pubkeyRouterAddress
      }`
    );
    if (!ENSO_SUPPORTED_CHAINS.has(Number(params.chainId))) {
      throw new Error(`ChainId ${params.chainId} is not supported by Enso`);
    }

    const delegateeAddress = ethers.utils.getAddress(LitAuth.authSigAddress);
    const toolIpfsCid = LitAuth.actionIpfsIds[0];
    const ensoClient = new EnsoClient({ apiKey: ENSO_API_KEY });
    const chainId = Number(params.chainId);
    const provider = new ethers.providers.JsonRpcProvider(params.rpcUrl);

    const pkpToolRegistryContract = await getPkpToolRegistryContract(
      PKP_TOOL_REGISTRY_ADDRESS
    );
    const pkp = await getPkpInfo(params.pkpEthAddress);
    const toolPolicy = await fetchToolPolicyFromRegistry(
      pkpToolRegistryContract,
      pkp.tokenId,
      delegateeAddress,
      toolIpfsCid
    );

    const tokenInData = await getToken(ensoClient, chainId, params.tokenIn);
    const amountInWei = parseUnits(
      params.amountIn,
      tokenInData.decimals
    ).toString();

    if (
      toolPolicy.enabled &&
      toolPolicy.policyIpfsCid !== undefined &&
      toolPolicy.policyIpfsCid !== '0x' &&
      toolPolicy.policyIpfsCid !== ''
    ) {
      console.log(`Executing policy ${toolPolicy.policyIpfsCid}`);
      await Lit.Actions.call({
        ipfsId: toolPolicy.policyIpfsCid,
        params: {
          parentToolIpfsCid: toolIpfsCid,
          pkpToolRegistryContractAddress: PKP_TOOL_REGISTRY_ADDRESS,
          pkpTokenId: pkp.tokenId,
          delegateeAddress,
          toolParameters: {
            amountIn: amountInWei,
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
          },
        },
      });
    } else {
      console.log(
        `No policy found for tool ${toolIpfsCid} on PKP ${pkp.tokenId} for delegatee ${delegateeAddress}`
      );
    }

    // Add your tool execution logic here
    const routeData = await getRoute(
      ensoClient,
      chainId,
      pkp.ethAddress,
      params.tokenIn,
      amountInWei,
      params.tokenOut
    );

    if (params.tokenIn.toLowerCase() !== ENSO_ETH) {
      const gasData = await getGasData(provider, pkp.ethAddress);

      const approveTx = await createApproveTx(
        ensoClient,
        chainId,
        gasData,
        pkp.ethAddress,
        tokenInData.address,
        amountInWei
      );

      const signedApprovalTx = await signTx(
        pkp.publicKey,
        approveTx,
        'erc20ApprovalSig'
      );

      const approvalHash = await broadcastTransaction(
        provider,
        signedApprovalTx
      );
      console.log('Approval transaction hash:', approvalHash);

      // Wait for approval confirmation
      console.log('Waiting for approval confirmation...');
      const approvalConfirmation = await provider.waitForTransaction(
        approvalHash,
        1
      );

      if (approvalConfirmation.status === 0) {
        throw new Error('Approval transaction failed');
      }
    }

    const gasData = await getGasData(provider, pkp.ethAddress);
    const routeTx = await createRouteTx(routeData, gasData, chainId);
    const signedRouteTx = await signTx(pkp.publicKey, routeTx, 'erc20RouteSig');
    const routeHash = await broadcastTransaction(provider, signedRouteTx);
    console.log('Route transaction hash', routeHash);

    Lit.Actions.setResponse({
      response: JSON.stringify({
        routeHash,
        status: 'success',
      }),
    });
  } catch (err: any) {
    console.error('Error:', err);

    // Extract detailed error information
    const errorDetails = {
      message: err.message,
      code: err.code,
      reason: err.reason,
      error: err.error,
      ...(err.transaction && { transaction: err.transaction }),
      ...(err.receipt && { receipt: err.receipt }),
    };

    Lit.Actions.setResponse({
      response: JSON.stringify({
        status: 'error',
        error: err.message || String(err),
        details: errorDetails,
      }),
    });
  }
})();
