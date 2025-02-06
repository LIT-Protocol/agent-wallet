import { EnsoClient } from '@ensofinance/sdk';

/**
 * Retrieves the ERC20 token information
 * @param {EnsoClient} ensoClient - Enso API Client
 * @param {number} chainId - Chain ID of blockchain network
 * @param {string} token - ERC20 Token address
 * @returns {Promise<{bestQuote: any;bestFee: number;amountOutMin: any;}>} The best quote and fee tier.
 */
export const getToken = async (
  ensoClient: EnsoClient,
  chainId: number,
  token: string
) => {
  console.log('Fetching token data...');
  const tokenData = await ensoClient.getTokenData({
    chainId,
    address: token as `0x${string}`,
    includeMetadata: true,
  });

  if (tokenData.data.length !== 1) {
    throw new Error(`Token ${token} is not supported by Enso`);
  }

  return tokenData.data[0];
};
