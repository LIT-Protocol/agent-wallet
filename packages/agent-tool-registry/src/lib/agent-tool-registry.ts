import {
  SendERC20LitActionParameters,
  SendERC20LitActionSchema,
  SendERC20LitActionMetadata,
  SendERC20LitActionParameterDescriptions,
  isValidSendERC20Parameters,
  sendERC20LitActionDescription,
  SendERC20Policy,
  SendERC20PolicySchema,
  encodeSendERC20Policy,
  decodeSendERC20Policy,
  IPFS_CID as SendERC20IpfsCid,
} from '@lit-protocol/agent-tool-erc20-send';

export const SendERC20 = {
  description: sendERC20LitActionDescription,
  ipfsCid: SendERC20IpfsCid,

  Parameters: {
    type: {} as SendERC20LitActionParameters,
    schema: SendERC20LitActionSchema,
    descriptions: SendERC20LitActionParameterDescriptions,
    validate: isValidSendERC20Parameters,
  },

  metadata: SendERC20LitActionMetadata,

  Policy: {
    type: {} as SendERC20Policy,
    schema: SendERC20PolicySchema,
    encode: encodeSendERC20Policy,
    decode: decodeSendERC20Policy,
  },
} as const;

export const SUPPORTED_TOOLS = ['SendERC20'] as const;
export type SupportedToolTypes = (typeof SUPPORTED_TOOLS)[number];

export interface ToolInfo {
  name: string;
  description: string;
  ipfsCid: string;
  parameters: {
    name: string;
    description: string;
  }[];
}

export function listAvailableTools(): ToolInfo[] {
  return [
    {
      name: 'SendERC20',
      description: SendERC20.description as string,
      ipfsCid: SendERC20.ipfsCid,
      parameters: Object.entries(SendERC20.Parameters.descriptions).map(
        ([name, description]) => ({
          name,
          description: description as string,
        })
      ),
    },
  ];
}

export function isToolSupported(
  toolType: string
): toolType is SupportedToolTypes {
  return SUPPORTED_TOOLS.includes(toolType as SupportedToolTypes);
}

export function getToolFromRegistry(toolName: string) {
  if (!isToolSupported(toolName)) {
    throw new Error(`Unsupported tool: ${toolName}`);
  }

  if (toolName === 'SendERC20') return SendERC20;

  // TypeScript will catch if we miss any supported tool
  throw new Error(
    `Tool ${toolName} is supported but not implemented in registry`
  );
}
