import prompts from 'prompts';
import { Admin as AwAdmin } from '@lit-protocol/agent-wallet';
import { logger } from '../../utils/logger';

type StoredKeyData = {
  id: string;
  publicKey: string;
};

/**
 * Prompts the user to view and manage wrapped keys
 * @param awAdmin The Admin instance
 * @returns The selected wrapped key ID if the user wants to manage it, undefined otherwise
 */
export const promptViewWrappedKeys = async (awAdmin: AwAdmin): Promise<string | undefined> => {
  const wrappedKeys = await awAdmin.getWrappedKeys();

  if (wrappedKeys.length === 0) {
    logger.info('No wrapped keys found');
    return undefined;
  }

  const choices = wrappedKeys.map((wk: StoredKeyData) => ({
    title: `Wrapped Key: ${wk.publicKey}`,
    description: `ID: ${wk.id}`,
    value: wk.id,
  }));

  const { selectedKey } = await prompts({
    type: 'select',
    name: 'selectedKey',
    message: 'Select a wrapped key to manage:',
    choices: [
      ...choices,
      { title: 'Back', value: undefined }
    ],
  });

  if (selectedKey === undefined) {
    logger.error('No selection made');
    process.exit(1);
  }

  return selectedKey;
}; 