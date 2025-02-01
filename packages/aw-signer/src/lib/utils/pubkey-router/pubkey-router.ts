import { LIT_RPC } from '@lit-protocol/constants';
import { ethers } from 'ethers';

import { ToolRegistryConfig } from '../../types';

export const DEFAULT_REGISTRY_CONFIG: Record<string, ToolRegistryConfig> = {
  'datil-dev': {
    rpcUrl: LIT_RPC.CHRONICLE_YELLOWSTONE,
    contractAddress: '0xbc01f21C58Ca83f25b09338401D53D4c2344D1d9',
  },
  'datil-test': {
    rpcUrl: LIT_RPC.CHRONICLE_YELLOWSTONE,
    contractAddress: '0x65C3d057aef28175AfaC61a74cc6b27E88405583',
  },
  'datil': {
    rpcUrl: LIT_RPC.CHRONICLE_YELLOWSTONE,
    contractAddress: '0xF182d6bEf16Ba77e69372dD096D8B70Bc3d5B475',
  },
} as const;

export const PUBKEY_ROUTER_ABI = [
    {
        inputs: [
            { internalType: "address", name: "ethAddress", type: "address" },
        ],
        name: "ethAddressToPkpId",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
];

export const getPubkeyRouterContract = (
  { rpcUrl, contractAddress }: ToolRegistryConfig,
  signer: ethers.Signer
) => {
  const contract = new ethers.Contract(
    contractAddress,
    PUBKEY_ROUTER_ABI,
    new ethers.providers.JsonRpcProvider(rpcUrl)
  );

  // Connect the signer to allow write operations
  return contract.connect(signer);
};
