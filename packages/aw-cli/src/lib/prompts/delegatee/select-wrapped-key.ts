import prompts from 'prompts';
import { Delegatee as AwDelegatee } from '@lit-protocol/agent-wallet';
import { logger } from '../../utils/logger';

/**
 * Prompts the user to select a wrapped key
 * @param awDelegatee The Delegatee instance
 * @param wrappedKeys Optional list of wrapped keys to choose from. If not provided, all wrapped keys will be fetched.
 * @returns The selected wrapped key or undefined if none selected
 */
export const promptSelectWrappedKey = async (
  awDelegatee: AwDelegatee,
  wrappedKeys?: any[]
) => {
  const keys = wrappedKeys || await awDelegatee.getWrappedKeys();

  if (keys.length === 0) {
    logger.error('No wrapped keys found. Please ask the admin to mint a wrapped key first.');
    process.exit(1);
  }

  const choices = keys.map((wk) => ({
    title: `Wrapped Key: ${wk.publicKey}`,
    description: `ID: ${wk.id}`,
    value: wk,
  }));

  const { selectedKey } = await prompts({
    type: 'select',
    name: 'selectedKey',
    message: 'Select a wrapped key to use:',
    choices,
  });

  if (!selectedKey) {
    logger.error('No wrapped key selected');
    process.exit(1);
  }

  return selectedKey;
}; 