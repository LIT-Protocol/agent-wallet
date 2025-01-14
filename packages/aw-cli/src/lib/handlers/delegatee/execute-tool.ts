import type {
  DelegatedPkpInfo,
  Delegatee as AwDelegatee,
} from '@lit-protocol/agent-wallet';

// Import the logger utility for logging messages.
import { logger } from '../../utils/logger';

// Import prompt utilities for user interaction.
import {
  promptSelectPkp,
  promptSelectTool,
  promptToolParams,
  promptSelectWrappedKey,
} from '../../prompts/delegatee';

// Import custom error types and utilities.
import { AwCliError, AwCliErrorType } from '../../errors';

/**
 * Handles the process of executing a tool in the Full Self-Signing (AW) system.
 * This function retrieves delegated PKPs, lists registered tools for the selected PKP,
 * prompts the user to select a tool and provide parameters, and executes the tool.
 * It also handles errors that occur during the process.
 *
 * @param awDelegatee - An instance of the AwDelegatee class.
 */
export const handleExecuteTool = async (awDelegatee: AwDelegatee) => {
  try {
    // Retrieve the list of PKPs delegated to the user.
    const pkps = await awDelegatee.getDelegatedPkps();

    // If no PKPs are delegated, throw an error.
    if (pkps.length === 0) {
      throw new AwCliError(
        AwCliErrorType.DELEGATEE_GET_TOOL_POLICY_NO_PKPS,
        'No PKPs are currently delegated to you.'
      );
    }

    // Prompt the user to select a PKP.
    const selectedPkp = (await promptSelectPkp(pkps)) as DelegatedPkpInfo;

    const registeredTools = await awDelegatee.getRegisteredToolsForPkp(
      selectedPkp.tokenId
    );

    if (
      registeredTools.toolsWithPolicies.length === 0 &&
      registeredTools.toolsWithoutPolicies.length === 0
    ) {
      throw new AwCliError(
        AwCliErrorType.DELEGATEE_SELECT_TOOL_NO_TOOLS,
        'No registered tools for this PKP.'
      );
    }

    if (registeredTools.toolsWithPolicies.length > 0) {
      logger.log(`Tools with Policies for PKP ${selectedPkp.ethAddress}:`);
      registeredTools.toolsWithPolicies.forEach((tool) => {
        logger.log(`  - ${tool.name} (${tool.ipfsCid})`);
      });
    }

    // Process tools without policies.
    if (registeredTools.toolsWithoutPolicies.length > 0) {
      logger.log(`Tools without Policies for PKP ${selectedPkp.ethAddress}:`);
      registeredTools.toolsWithoutPolicies.forEach((tool) => {
        logger.log(`  - ${tool.name} (${tool.ipfsCid})`);
      });
    }

    // Select a tool
    const selectedTool = await promptSelectTool(
      registeredTools.toolsWithPolicies,
      registeredTools.toolsWithoutPolicies
    );

    // If the tool has a policy, display it
    const toolWithPolicy = registeredTools.toolsWithPolicies.find(
      (tool) => tool.ipfsCid === selectedTool.ipfsCid
    );
    if (toolWithPolicy) {
      const policy = await awDelegatee.getToolPolicy(
        selectedPkp.tokenId,
        selectedTool.ipfsCid
      );
      const decodedPolicy = selectedTool.policy.decode(policy.policy);
      logger.info('Tool Policy:');
      logger.log(JSON.stringify(decodedPolicy, null, 2));
    }

    // Prompt the user to provide tool parameters.
    logger.info('Enter Tool Parameters:');
    const params = await promptToolParams(selectedTool, selectedPkp.ethAddress);

    // If this is a Solana tool, prompt for wrapped key selection
    if (selectedTool.chain === 'solana') {
      // Get all wrapped keys and filter by the selected PKP's address
      const wrappedKeys = await awDelegatee.getWrappedKeys();
      const pkpWrappedKeys = wrappedKeys.filter(key => key.pkpAddress === selectedPkp.ethAddress);
      
      if (pkpWrappedKeys.length === 0) {
        logger.error('No wrapped keys found for this PKP. Please ask an admin to mint a wrapped key first.');
        return;
      }

      const wrappedKey = await promptSelectWrappedKey(awDelegatee, pkpWrappedKeys);
      params.wrappedKeyId = wrappedKey.id;
      params.ciphertext = wrappedKey.ciphertext;
      params.dataToEncryptHash = wrappedKey.dataToEncryptHash;
      params.accessControlConditions = [
        {
          contractAddress: '',
          standardContractType: '',
          chain: 'ethereum',
          method: '',
          parameters: [':currentActionIpfsId'],
          returnValueTest: {
            comparator: '=',
            value: 'QmYf6Bm29HXbTNLCi4ELTidJ1UYdj4Nk8cpm1xfeRLqDqc',
          },
        },
      ];
    }

    // Execute the tool.
    logger.loading('Executing tool...');
    const response = await awDelegatee.executeTool({
      ipfsId: selectedTool.ipfsCid,
      jsParams: {
        params,
      },
    });

    // Log a success message once the tool is executed.
    logger.success('Tool executed successfully');

    // Log the execution response.
    console.log('response', response);
  } catch (error) {
    // Handle specific errors related to tool execution.
    if (error instanceof AwCliError) {
      if (error.type === AwCliErrorType.ADMIN_SELECT_PKP_CANCELLED) {
        logger.error('No PKP selected');
        return;
      }
      if (error.type === AwCliErrorType.DELEGATEE_SELECT_TOOL_NO_TOOLS) {
        logger.error('No tools available for the selected PKP');
        return;
      }
      if (error.type === AwCliErrorType.DELEGATEE_SELECT_TOOL_CANCELLED) {
        logger.error('No tool selected');
        return;
      }
      if (
        error.type === AwCliErrorType.DELEGATEE_EXECUTE_TOOL_PARAMS_CANCELLED
      ) {
        logger.error('Tool parameter input cancelled');
        return;
      }
      if (error.type === AwCliErrorType.DELEGATEE_EXECUTE_TOOL_PARAMS_INVALID) {
        logger.error(error.message);
        return;
      }
      if (
        error.type === AwCliErrorType.DELEGATEE_EXECUTE_TOOL_POLICY_VIOLATED
      ) {
        logger.error('Tool execution violates policy constraints');
        return;
      }
    }

    // Re-throw any other errors to be handled by the caller.
    throw error;
  }
};
