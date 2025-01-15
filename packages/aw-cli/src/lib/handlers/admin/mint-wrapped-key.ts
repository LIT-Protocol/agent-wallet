import {
    Admin as AwAdmin,
    AwSignerError,
    AwSignerErrorType,
    PkpInfo,
  } from '@lit-protocol/agent-wallet';
  
  import { promptAdminInsufficientBalance } from '../../prompts/admin/insufficient-balance';
  import { logger } from '../../utils/logger';
  
  export async function handleMintWrappedKey(awAdmin: AwAdmin, pkp: PkpInfo) {
    try {
      const wrappedKey = await awAdmin.mintWrappedKey(pkp.info.tokenId);
      logger.success(`Minted Wrapped Key: ${wrappedKey.publicKey}`);
      return;
  
    } catch (error) {
      if (error instanceof AwSignerError) {
        if (error.type === AwSignerErrorType.INSUFFICIENT_BALANCE_PKP_MINT) {
          // Prompt the user to fund the account if the balance is insufficient.
          const hasFunded = await promptAdminInsufficientBalance();
          if (hasFunded) {
            return handleMintWrappedKey(awAdmin, pkp);
        }
      }
    }

    throw error;
  }
}
