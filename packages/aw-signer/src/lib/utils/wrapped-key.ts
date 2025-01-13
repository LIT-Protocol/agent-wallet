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
    const wk = storage.getItem(`wk:${id}`);
    if (wk) {
      return JSON.parse(wk) as StoredKeyData;
    }
  } catch (error) {
    throw new AwSignerError(
      AwSignerErrorType.STORAGE_FAILED_TO_GET_ITEM,
      'Failed to retrieve Wrapped Key from storage',
      {
        details: error,
      }
    );
  }
  return null;
}

export function saveWrappedKeyToStorage(storage: LocalStorage, wrappedKey: StoredKeyData) {
  storage.setItem(`wk:${wrappedKey.id}`, JSON.stringify(wrappedKey));
  
  // Update the index
  const index = storage.getItem('wk:index');
  const ids = index ? JSON.parse(index) as string[] : [];
  if (!ids.includes(wrappedKey.id)) {
    ids.push(wrappedKey.id);
    storage.setItem('wk:index', JSON.stringify(ids));
  }
}

export function loadWrappedKeysFromStorage(storage: LocalStorage): StoredKeyData[] {
  const index = storage.getItem('wk:index');
  if (!index) {
    return [];
  }

  const ids = JSON.parse(index) as string[];
  const wrappedKeys: StoredKeyData[] = [];
  
  for (const id of ids) {
    const wk = loadWrappedKeyFromStorage(storage, id);
    if (wk) {
      wrappedKeys.push(wk);
    }
  }
  
  return wrappedKeys;
}

export async function mintWrappedKey(
    litNodeClient: LitNodeClientNodeJs,
    pkpSessionSigs: SessionSigsMap,
    storage: LocalStorage,
    pkpTokenId: string
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
      contractAddress: "",
      standardContractType: "",
      chain: "ethereum",
      method: "",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: "=",
        value: pkpAddress,
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
    memo: "FSS Signer Wrapped Key",
    publicKey: solanaKeypair.publicKey.toString(),
  });

  console.log(`✅ Decrypted private key: ${solanaKeypair.secretKey}`);

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
  // Remove the wrapped key
  storage.removeItem(`wk:${id}`);
  
  // Update the index
  const index = storage.getItem('wk:index');
  if (index) {
    const ids = JSON.parse(index) as string[];
    const newIds = ids.filter(wkId => wkId !== id);
    storage.setItem('wk:index', JSON.stringify(newIds));
  }
}