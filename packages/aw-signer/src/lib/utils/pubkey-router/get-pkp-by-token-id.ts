import { ethers } from 'ethers';

export const getPkpEthAddressByTokenId = async(
  pubkeyRouterContract: ethers.Contract,
  tokenId: string
) => {
  const pkpEthAddress = await pubkeyRouterContract.ethAddressToPkpId(tokenId);
  return pkpEthAddress;
}
