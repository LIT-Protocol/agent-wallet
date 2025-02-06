import { EnsoClient } from '@ensofinance/sdk';

/**
 * Generate and return ERC20 Approval tx
 * @param {EnsoClient} ensoClient - Enso API Client
 * @param {number} chainId - Chain ID of blockchain network
 * @param {any} gasData - Gas data of chain
 * @param {string} sender - Address from whom the transaction will be executed
 * @param {string} token - ERC20 Token address
 * @param {string} amount - amount to approve
 * @returns {Promise<{bestQuote: any;bestFee: number;amountOutMin: any;}>} The best quote and fee tier.
 */
export const createApproveTx = async (
  ensoClient: EnsoClient,
  chainId: number,
  gasData: any,
  sender: string,
  token: string,
  amount: string
) => {
  const approve = await ensoClient.getApprovalData({
    chainId,
    fromAddress: sender as `0x${string}`,
    amount,
    tokenAddress: token as `0x${string}`,
  });

  return {
    to: approve.tx.to,
    data: approve.tx.data,
    value: '0x0',
    gasLimit: ((BigInt(approve.gas) * 15n) / 10n).toString(), // Increase gas by 50%
    maxFeePerGas: gasData.maxFeePerGas,
    maxPriorityFeePerGas: gasData.maxPriorityFeePerGas,
    nonce: gasData.nonce,
    chainId: chainId.toString(),
    type: 2,
  };
};