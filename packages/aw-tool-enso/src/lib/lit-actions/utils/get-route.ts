import { EnsoClient, RouteParams } from '@ensofinance/sdk';

/**
 * Retrieves the best route from tokenIn to tokenOut through Enso
 * @param {EnsoClient} ensoClient - Enso API Client
 * @param {number} chainId - ChainID of blockchain network
 * @param {string} fromAddress - Address from whom the transaction will be executed
 * @param {string} tokenIn - The token to route away from
 * @param {string} amountIn - Amount of tokenIn
 * @param {string} tokenOut - The token to route to
 * @returns {Promise<{bestQuote: any;bestFee: number;amountOutMin: any;}>} The best quote and fee tier.
 */
export const getRoute = async (
  ensoClient: EnsoClient,
  chainId: number,
  fromAddress: string,
  tokenIn: string,
  amountIn: string,
  tokenOut: string
) => {
  const routeParams: RouteParams = {
    chainId,
    tokenIn: tokenIn as `0x${string}`,
    tokenOut: tokenOut as `0x${string}`,
    amountIn: amountIn,
    fromAddress: fromAddress as `0x${string}`,
    receiver: fromAddress as `0x${string}`,
    spender: fromAddress as `0x${string}`,
  };

  console.log('Fetching the best route through Enso...');
  const routeData = await ensoClient.getRouterData(routeParams);
  return routeData;
  //return {
  //  ...routeData,
  //  tx: {
  //    to: routeData.tx.to,
  //    data: routeData.tx.data,
  //    value: routeData.tx.value,
  //    gasLimit: routeData.gas,
  //    maxFeePerGas: gasData.maxFeePerGas,
  //    maxPriorityFeePerGas: gasData.maxPriorityFeePerGas,
  //    nonce: gasData.nonce,
  //    chainId: chainId.toString(),
  //    type: 2,
  //  },
  //};
};
