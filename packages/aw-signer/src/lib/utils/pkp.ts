import type { LitContracts } from '@lit-protocol/contracts-sdk';
import { ethers } from 'ethers';

import type { LocalStorage } from './storage';
import { PkpInfo } from '../types';
import { AwSignerError, AwSignerErrorType } from '../errors';

export function loadPkpsFromStorage(storage: LocalStorage): PkpInfo[] {
  try {
    const pkps = storage.getItem('pkps');
    if (pkps) {
      return JSON.parse(pkps) as PkpInfo[];
    }
  } catch (error) {
    throw new AwSignerError(
      AwSignerErrorType.STORAGE_FAILED_TO_GET_ITEM,
      'Failed to retrieve PKPs from storage',
      {
        details: error,
      }
    );
  }
  return [];
}

export function savePkpsToStorage(storage: LocalStorage, pkps: PkpInfo[]) {
  storage.setItem('pkps', JSON.stringify(pkps));
}

export async function mintPkp(
  litContracts: LitContracts,
  wallet: ethers.Wallet
): Promise<PkpInfo> {
  const mintCost = await litContracts.pkpNftContract.read.mintCost();
  if (mintCost.gt(await wallet.getBalance())) {
    throw new AwSignerError(
      AwSignerErrorType.INSUFFICIENT_BALANCE_PKP_MINT,
      `${await wallet.getAddress()} has insufficient balance to mint PKP: ${ethers.utils.formatEther(
        await wallet.getBalance()
      )} < ${ethers.utils.formatEther(mintCost)}`
    );
  }

  const mintMetadata = await litContracts.pkpNftContractUtils.write.mint();

  return {
    info: mintMetadata.pkp,
    mintTx: mintMetadata.tx,
    mintReceipt: mintMetadata.res,
  };
}
