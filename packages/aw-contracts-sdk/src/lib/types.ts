import { type LitNetwork } from '@lit-protocol/aw-tool-registry';
import type { AwTool } from '@lit-protocol/aw-tool';

export type ToolInfo = {
  toolIpfsCid: string;
  toolEnabled: boolean;
  delegatees: string[];
  delegateesPolicyIpfsCids: string[];
  delegateesPolicyEnabled: boolean[];
};

export type RegistryToolResult = {
  tool: AwTool<any, any>;
  network: LitNetwork;
} | null;

export type ToolMetadata = NonNullable<RegistryToolResult>['tool'] & {
  network: NonNullable<RegistryToolResult>['network'];
  toolEnabled?: boolean;
  delegatees: string[];
};

export type RegisteredToolWithPolicies = ToolMetadata & {
  delegatees: string[];
  delegateePolicies: {
    [delegatee: string]: {
      policyIpfsCid: string;
      policyEnabled: boolean;
    };
  };
};

export type RegisteredToolsResult = {
  toolsWithPolicies: {
    [ipfsCid: string]: RegisteredToolWithPolicies;
  };
  toolsWithoutPolicies: {
    [ipfsCid: string]: ToolMetadata;
  };
  toolsUnknownWithPolicies: {
    [ipfsCid: string]: {
      toolEnabled: boolean;
      delegatees: string[];
      delegateePolicies: {
        [delegatee: string]: {
          policyIpfsCid: string;
          policyEnabled: boolean;
        };
      };
    };
  };
  toolsUnknownWithoutPolicies: string[];
};
