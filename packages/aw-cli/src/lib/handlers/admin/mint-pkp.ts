import {
  Admin as AwAdmin,
  AwSignerError,
  AwSignerErrorType,
} from '@lit-protocol/agent-wallet';

import { promptAdminInsufficientBalance } from '../../prompts/admin/insufficient-balance';
import { logger } from '../../utils/logger';
import { promptManagePkp } from '../../prompts/admin/manage-pkp';
import { handleMintWrappedKey } from './mint-wrapped-key';

export async function handleMintPkp(awAdmin: AwAdmin) {
  try {
    const pkpInfo = await awAdmin.mintPkp();
    await handleMintWrappedKey(awAdmin, pkpInfo);
    logger.success(`Minted Agent Wallet: ${pkpInfo.info.ethAddress}`);

    const shouldManage = await promptManagePkp(pkpInfo);

    return { shouldManage, pkpInfo };
  } catch (error) {
    if (error instanceof AwSignerError) {
      if (error.type === AwSignerErrorType.INSUFFICIENT_BALANCE_PKP_MINT) {
        // Prompt the user to fund the account if the balance is insufficient.
        const hasFunded = await promptAdminInsufficientBalance();
        if (hasFunded) {
          return handleMintPkp(awAdmin);
        }
      }
    }

    throw error;
  }
}
