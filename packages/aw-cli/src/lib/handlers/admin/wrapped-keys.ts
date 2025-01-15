import { Admin as AwAdmin, AwSignerError } from '@lit-protocol/agent-wallet';
import { promptViewWrappedKeys } from '../../prompts/admin/view-wrapped-keys';
import { promptSelectPkp } from '../../prompts/admin/select-pkp';
import { logger } from '../../utils/logger';

export async function handleViewWrappedKeys(awAdmin: AwAdmin) {
  const selectedKeyId = await promptViewWrappedKeys(awAdmin);
  if (!selectedKeyId) {
    return;
  }

  try {
    const wrappedKey = await awAdmin.getWrappedKeyById(selectedKeyId);
    logger.info('Wrapped Key Details:');
    logger.info(`ID: ${wrappedKey.id}`);
    logger.info(`Public Key: ${wrappedKey.publicKey}`);
  } catch (error) {
    if (error instanceof AwSignerError) {
      logger.error(error.message);
    } else {
      logger.error('Failed to get wrapped key details');
    }
  }
}

export async function handleMintWrappedKey(awAdmin: AwAdmin) {
  const pkps = await awAdmin.getPkps();
  const pkp = await promptSelectPkp(pkps);
  if (!pkp) {
    return;
  }

  try {
    const wrappedKey = await awAdmin.mintWrappedKey(pkp.info.tokenId);
    logger.success(`Minted Wrapped Key: ${wrappedKey.publicKey}`);
  } catch (error) {
    if (error instanceof AwSignerError) {
      logger.error(error.message);
    } else {
      logger.error('Failed to mint wrapped key');
    }
  }
}

export async function handleRemoveWrappedKey(awAdmin: AwAdmin) {
  const selectedKeyId = await promptViewWrappedKeys(awAdmin);
  if (!selectedKeyId) {
    return;
  }

  try {
    const wrappedKey = await awAdmin.removeWrappedKey(selectedKeyId);
    logger.success(`Removed Wrapped Key: ${wrappedKey.publicKey}`);
  } catch (error) {
    if (error instanceof AwSignerError) {
      logger.error(error.message);
    } else {
      logger.error('Failed to remove wrapped key');
    }
  }
} 