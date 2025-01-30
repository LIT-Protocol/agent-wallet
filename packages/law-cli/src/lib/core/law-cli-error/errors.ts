export enum GeneralErrors {
  UNKNOWN_LAW_CLI_ERROR = 'UNKNOWN_LAW_CLI_ERROR',
  NO_ACTION_SELECTED = 'NO_ACTION_SELECTED',
}

export enum GetLitNetworkErrors {
  NO_LIT_NETWORK_SELECTED = 'NO_LIT_NETWORK_SELECTED',
}

export enum MainMenuErrors {
  NO_MAIN_MENU_ACTION_SELECTED = 'NO_MAIN_MENU_ACTION_SELECTED',
  UNKNOWN_MAIN_MENU_ACTION = 'UNKNOWN_MAIN_MENU_ACTION',
}

export enum CliSettingsMenuErrors {
  NO_CLI_SETTINGS_ACTION_SELECTED = 'NO_CLI_SETTINGS_ACTION_SELECTED',
  UNKNOWN_CLI_SETTINGS_ACTION = 'UNKNOWN_CLI_SETTINGS_ACTION',
}

export enum ChangeLitNetworkErrors {
  NO_LIT_NETWORK_SELECTED = 'NO_LIT_NETWORK_SELECTED',
}

export enum ManageRpcsMenuErrors {
  UNKNOWN_RPC_ACTION = 'UNKNOWN_RPC_ACTION',
}

export enum AddRpcErrors {
  CHAIN_NAME_EXISTS = 'CHAIN_NAME_EXISTS',
  ADD_RPC_CANCELLED = 'ADD_RPC_CANCELLED',
}

export enum EditRpcErrors {
  EDIT_RPC_CANCELLED = 'EDIT_RPC_CANCELLED',
  NO_RPCS_FOUND = 'NO_RPCS_FOUND',
}

export enum RemoveRpcErrors {
  REMOVE_RPC_CANCELLED = 'REMOVE_RPC_CANCELLED',
  NO_RPCS_FOUND = 'NO_RPCS_FOUND',
}

export enum AdminErrors {
  ADMIN_MISSING_PRIVATE_KEY = 'ADMIN_MISSING_PRIVATE_KEY',
  FAILED_TO_INITIALIZE_ADMIN = 'FAILED_TO_INITIALIZE_ADMIN',
  NO_PKPS_FOUND = 'NO_PKPS_FOUND',
  PKP_SELECTION_CANCELLED = 'PKP_SELECTION_CANCELLED',
}

export enum PermitToolErrors {
  PERMIT_TOOL_CANCELLED = 'PERMIT_TOOL_CANCELLED',
  NO_UNPERMITTED_TOOLS = 'NO_UNPERMITTED_TOOLS',
  ENABLE_TOOL_CANCELLED = 'ENABLE_TOOL_CANCELLED',
}

export enum RemoveToolErrors {
  REMOVE_TOOL_CANCELLED = 'REMOVE_TOOL_CANCELLED',
  NO_PERMITTED_TOOLS = 'NO_PERMITTED_TOOLS',
}

export enum EnableToolErrors {
  ENABLE_TOOL_CANCELLED = 'ENABLE_TOOL_CANCELLED',
  NO_DISABLED_TOOLS = 'NO_DISABLED_TOOLS',
}

export enum DisableToolErrors {
  DISABLE_TOOL_CANCELLED = 'DISABLE_TOOL_CANCELLED',
  NO_ENABLED_TOOLS = 'NO_ENABLED_TOOLS',
}

export enum ManagePoliciesMenuErrors {
  NO_MANAGE_POLICIES_ACTION_SELECTED = 'NO_MANAGE_POLICIES_ACTION_SELECTED',
}

export enum SetPolicyErrors {
  SET_POLICY_CANCELLED = 'SET_POLICY_CANCELLED',
  NO_TOOLS_FOUND = 'NO_TOOLS_FOUND',
}

export enum RemovePolicyErrors {
  REMOVE_POLICY_CANCELLED = 'REMOVE_POLICY_CANCELLED',
  NO_POLICIES_FOUND = 'NO_POLICIES_FOUND',
}

export enum EnablePolicyErrors {
  ENABLE_POLICY_CANCELLED = 'ENABLE_POLICY_CANCELLED',
  NO_DISABLED_POLICIES = 'NO_DISABLED_POLICIES',
}

export enum DisablePolicyErrors {
  DISABLE_POLICY_CANCELLED = 'DISABLE_POLICY_CANCELLED',
  NO_ENABLED_POLICIES = 'NO_ENABLED_POLICIES',
}

export enum GetToolPolicyErrors {
  GET_TOOL_POLICY_CANCELLED = 'GET_TOOL_POLICY_CANCELLED',
  NO_TOOLS_WITH_POLICIES = 'NO_TOOLS_WITH_POLICIES',
}

export enum GetDelegateesErrors {
  NO_DELEGATEES_FOUND = 'NO_DELEGATEES_FOUND',
}

export enum AddDelegateeErrors {
  ADD_DELEGATEE_CANCELLED = 'ADD_DELEGATEE_CANCELLED',
}

export enum RemoveDelegateeErrors {
  REMOVE_DELEGATEE_CANCELLED = 'REMOVE_DELEGATEE_CANCELLED',
  NO_DELEGATEES_FOUND = 'NO_DELEGATEES_FOUND',
}

export enum IsDelegateeErrors {
  IS_DELEGATEE_CANCELLED = 'IS_DELEGATEE_CANCELLED',
}

export enum ManageDelegateesMenuErrors {
  NO_MANAGE_DELEGATEES_ACTION_SELECTED = 'NO_MANAGE_DELEGATEES_ACTION_SELECTED',
  UNKNOWN_MANAGE_DELEGATEES_ACTION = 'UNKNOWN_MANAGE_DELEGATEES_ACTION',
}

export enum PermitToolForDelegateeErrors {
  NO_TOOLS_FOUND = 'NO_TOOLS_FOUND',
  NO_DELEGATEES_FOUND = 'NO_DELEGATEES_FOUND',
  PERMIT_TOOL_FOR_DELEGATEE_CANCELLED = 'PERMIT_TOOL_FOR_DELEGATEE_CANCELLED',
}

export enum UnpermitToolForDelegateeErrors {
  NO_PERMITTED_TOOLS = 'NO_PERMITTED_TOOLS',
  UNPERMIT_TOOL_FOR_DELEGATEE_CANCELLED = 'UNPERMIT_TOOL_FOR_DELEGATEE_CANCELLED',
}

export enum GetToolPolicyParameterErrors {
  NO_TOOLS_WITH_POLICIES = 'NO_TOOLS_WITH_POLICIES',
  NO_DELEGATEES = 'NO_DELEGATEES',
  NO_PARAMETERS = 'NO_PARAMETERS',
  GET_CANCELLED = 'GET_CANCELLED',
}

export enum SetToolPolicyParameterErrors {
  NO_TOOLS_WITH_POLICIES = 'NO_TOOLS_WITH_POLICIES',
  NO_DELEGATEES = 'NO_DELEGATEES',
  SET_CANCELLED = 'SET_CANCELLED',
  PARAMETER_EXISTS = 'PARAMETER_EXISTS',
  FAILED = 'FAILED',
}

export enum RemoveToolPolicyParameterErrors {
  NO_TOOLS_WITH_POLICIES = 'NO_TOOLS_WITH_POLICIES',
  NO_DELEGATEES = 'NO_DELEGATEES',
  NO_PARAMETERS = 'NO_PARAMETERS',
  REMOVE_CANCELLED = 'REMOVE_CANCELLED',
  FAILED = 'FAILED',
}

// Combined type for all errors
export type LawCliErrorType =
  | GetLitNetworkErrors
  | GeneralErrors
  | MainMenuErrors
  | CliSettingsMenuErrors
  | ChangeLitNetworkErrors
  | ManageRpcsMenuErrors
  | AddRpcErrors
  | EditRpcErrors
  | RemoveRpcErrors
  | AdminErrors
  | PermitToolErrors
  | RemoveToolErrors
  | EnableToolErrors
  | DisableToolErrors
  | ManagePoliciesMenuErrors
  | SetPolicyErrors
  | RemovePolicyErrors
  | EnablePolicyErrors
  | DisablePolicyErrors
  | GetToolPolicyErrors
  | GetDelegateesErrors
  | AddDelegateeErrors
  | RemoveDelegateeErrors
  | IsDelegateeErrors
  | ManageDelegateesMenuErrors
  | PermitToolForDelegateeErrors
  | UnpermitToolForDelegateeErrors
  | GetToolPolicyParameterErrors
  | SetToolPolicyParameterErrors
  | RemoveToolPolicyParameterErrors;
