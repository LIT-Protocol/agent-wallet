import type { LitNodeClientNodeJs } from '@lit-protocol/lit-node-client-nodejs';
import type { AccessControlConditions, SessionSigsMap } from '@lit-protocol/types';
import { StoredKeyData } from "@lit-protocol/wrapped-keys";
import { encryptString } from "@lit-protocol/encryption";
import { Keypair } from "@solana/web3.js";

import type { LocalStorage } from './storage';
import { AwSignerError, AwSignerErrorType } from '../errors';
import { getEncryptedKey, storeEncryptedKey } from '@lit-protocol/wrapped-keys/src/lib/api';

export function loadWrappedKeyFromStorage(storage: LocalStorage, id: string): StoredKeyData | null {
  try {
    const wrappedKeys = loadWrappedKeysFromStorage(storage);
    return wrappedKeys.find(wk => wk.id === id) || null;
  } catch (error) {
    throw new AwSignerError(
      AwSignerErrorType.STORAGE_FAILED_TO_GET_ITEM,
      'Failed to retrieve Wrapped Key from storage',
      {
        details: error,
      }
    );
  }
}

export function saveWrappedKeyToStorage(storage: LocalStorage, wrappedKey: StoredKeyData) {
  const wrappedKeys = loadWrappedKeysFromStorage(storage);
  const index = wrappedKeys.findIndex(wk => wk.id === wrappedKey.id);
  
  if (index === -1) {
    wrappedKeys.push(wrappedKey);
  } else {
    wrappedKeys[index] = wrappedKey;
  }
  
  storage.setItem('wks', JSON.stringify(wrappedKeys));
}

export function loadWrappedKeysFromStorage(storage: LocalStorage): StoredKeyData[] {
  const wks = storage.getItem('wks');
  if (!wks) {
    return [];
  }
  
  try {
    return JSON.parse(wks) as StoredKeyData[];
  } catch (error) {
    throw new AwSignerError(
      AwSignerErrorType.STORAGE_FAILED_TO_GET_ITEM,
      'Failed to parse wrapped keys from storage',
      {
        details: error,
      }
    );
  }
}

export async function mintWrappedKey(
    litNodeClient: LitNodeClientNodeJs,
    pkpSessionSigs: SessionSigsMap,
    storage: LocalStorage,
  ): Promise<StoredKeyData> {

  const solanaKeypair = Keypair.generate();
  console.log('Solana Keypair:', {
    publicKey: solanaKeypair.publicKey.toString(),
    secretKey: Array.from(solanaKeypair.secretKey)
  });

  const pkpAddress = getPkpAddressFromSessionSigs(pkpSessionSigs);
  console.log('Using PKP address for access control:', pkpAddress);

  const accessControlConditions: AccessControlConditions = [
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

  const { ciphertext, dataToEncryptHash } = await encryptString({
    accessControlConditions: accessControlConditions,
    dataToEncrypt: Buffer.from(solanaKeypair.secretKey).toString('base64'),
  },
  litNodeClient
  );

  const storeResponse = await storeEncryptedKey({
    pkpSessionSigs,
    litNodeClient,
    ciphertext,
    dataToEncryptHash,
    keyType: "ed25519",
    memo: "Agent Wallet Wrapped Key",
    publicKey: solanaKeypair.publicKey.toString(),
  });

  const getEncryptedKeyResponse = await getEncryptedKey({
    pkpSessionSigs,
    litNodeClient,
    id: storeResponse.id,
  });

  saveWrappedKeyToStorage(storage, getEncryptedKeyResponse);

  return getEncryptedKeyResponse;
}

function getPkpAddressFromSessionSigs(pkpSessionSigs: SessionSigsMap) {
  const [[, sessionSig]] = Object.entries(pkpSessionSigs);
  if (!sessionSig) {
    throw new Error('No session signatures found');
  }

  const { capabilities } = JSON.parse(sessionSig.signedMessage);
  const pkpCapability = capabilities?.find(
    (cap: { algo: string }) => cap.algo === 'LIT_BLS'
  );

  if (!pkpCapability) {
    throw new Error('No PKP capability found in session signatures');
  }

  return pkpCapability.address;
}

export function removeWrappedKeyFromStorage(storage: LocalStorage, id: string) {
  const wrappedKeys = loadWrappedKeysFromStorage(storage);
  const newWrappedKeys = wrappedKeys.filter(wk => wk.id !== id);
  storage.setItem('wks', JSON.stringify(newWrappedKeys));
}