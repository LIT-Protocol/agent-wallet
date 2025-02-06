import type { AwTool } from '@lit-protocol/aw-tool';
import { ERC20Transfer } from '@lit-protocol/aw-tool-erc20-transfer';
import { UniswapSwap } from '@lit-protocol/aw-tool-uniswap-swap';
import { SignEcdsa } from '@lit-protocol/aw-tool-sign-ecdsa';
import { Enso } from '@lit-protocol/aw-tool-enso';

/**
 * Represents the Lit network environment.
 * Can be one of the predefined Lit network types: `datil-dev`, `datil-test`, or `datil`.
 */
export type LitNetwork = 'datil-dev' | 'datil-test' | 'datil';

/**
 * Represents a tool that is specific to a Lit network.
 * @template T - The type of the tool, which must extend `AwTool`.
 */
export type NetworkSpecificTool<T extends AwTool<any, any>> = Record<
  LitNetwork,
  T
>;

/**
 * Represents a collection of tools, categorized by whether they have policies.
 */
export type PermittedTools = {
  /** Tools that have associated policies. */
  toolsWithPolicies: AwTool<any, any>[];

  /** Tools that do not have associated policies. */
  toolsWithoutPolicies: AwTool<any, any>[];
};

/**
 * A registry for storing and managing tools.
 * The registry maps tool names to their network-specific implementations.
 */
const toolRegistry = new Map<string, NetworkSpecificTool<AwTool<any, any>>>();

/**
 * Registers a tool in the Tool Registry.
 * @param name - The name of the tool.
 * @param tool - The network-specific implementation of the tool.
 */
export function registerTool<T extends AwTool<any, any>>(
  name: string,
  tool: NetworkSpecificTool<T>
): void {
  toolRegistry.set(name, tool);
}

/**
 * Retrieves a tool from the Tool Registry by its name and network.
 * @param name - The name of the tool.
 * @param network - The Lit network for which the tool is registered.
 * @returns The tool if found, or `null` if the tool is not registered for the specified network.
 */
export function getToolByName<T extends AwTool<any, any>>(
  name: string,
  network: LitNetwork
): T | null {
  const tool = toolRegistry.get(name);
  if (!tool) return null;
  return tool[network] as T;
}

/**
 * Finds a tool by its IPFS CID (Content Identifier).
 * @param ipfsCid - The IPFS CID of the tool.
 * @returns An object containing the tool and its network if found, or `null` if the tool is not found.
 */
export function getToolByIpfsCid<T extends AwTool<any, any>>(
  ipfsCid: string
): { tool: T; network: LitNetwork } | null {
  for (const [, networkTools] of toolRegistry.entries()) {
    for (const [network, tool] of Object.entries(networkTools)) {
      if (tool.ipfsCid === ipfsCid) {
        return {
          tool: tool as T,
          network: network as LitNetwork,
        };
      }
    }
  }
  return null;
}

/**
 * Lists all registered tools for a specific network.
 * @param network - The Lit network for which to list the tools.
 * @returns An array of tools registered for the specified network.
 */
export function listToolsByNetwork<T extends AwTool<any, any>>(
  network: LitNetwork
): Array<T> {
  return Array.from(toolRegistry.values()).map(
    (networkTools) => networkTools[network] as T
  );
}

/**
 * Lists all registered tools for all networks.
 * @returns An array of objects containing the tool and its network.
 */
export function listAllTools<T extends AwTool<any, any>>(): Array<{
  tool: T;
  network: LitNetwork;
}> {
  const tools: Array<{ tool: T; network: LitNetwork }> = [];

  for (const networkTools of toolRegistry.values()) {
    for (const [network, tool] of Object.entries(networkTools)) {
      tools.push({
        tool: tool as T,
        network: network as LitNetwork,
      });
    }
  }

  return tools;
}

// Register the ERC20Transfer tool
registerTool('ERC20Transfer', ERC20Transfer);
registerTool('UniswapSwap', UniswapSwap);
registerTool('SignEcdsa', SignEcdsa);
registerTool('Enso', Enso);
