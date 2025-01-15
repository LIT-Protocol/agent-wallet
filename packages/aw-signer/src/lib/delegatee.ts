import { LIT_ABILITY } from '@lit-protocol/constants';
import { LitContracts } from '@lit-protocol/contracts-sdk';
import { LitNodeClientNodeJs } from '@lit-protocol/lit-node-client-nodejs';
import {
  createSiweMessage,
  generateAuthSig,
  LitAccessControlConditionResource,
  LitActionResource,
  LitPKPResource,
} from '@lit-protocol/auth-helpers';
import type {
  AuthSig,
  ExecuteJsResponse,
  JsonExecutionSdkParams,
} from '@lit-protocol/types';
import { type AwTool } from '@lit-protocol/aw-tool';
import { ethers } from 'ethers';

import type {
  DelegatedPkpInfo,
  LitNetwork,
  UnknownRegisteredToolWithPolicy,
  AgentConfig,
  IntentMatcher,
  CredentialStore,
  IntentMatcherResponse,
  CredentialsFor,
} from './types';
import {
  isCapacityCreditExpired,
  loadCapacityCreditFromStorage,
  mintCapacityCredit,
  requiresCapacityCredit,
  saveCapacityCreditToStorage,
} from './utils/capacity-credit';
import { LocalStorage } from './utils/storage';
import { AwSignerError, AwSignerErrorType } from './errors';
import {
  DEFAULT_REGISTRY_CONFIG,
  getPkpToolPolicyRegistryContract,
  getRegisteredTools,
  getToolPolicy,
} from './utils/pkp-tool-registry';
import { loadWrappedKeysFromStorage, loadWrappedKeyFromStorage } from './utils/wrapped-key';

/**
 * The `Delegatee` class is responsible for managing the Delegatee role in the Lit Protocol.
 * It handles tasks such as retrieving delegated PKPs, executing tools, and managing capacity credits.
 */
export class Delegatee implements CredentialStore {
  private static readonly DEFAULT_STORAGE_PATH =
    './.aw-signer-delegatee-storage';
  private static readonly ADMIN_STORAGE_PATH = './.aw-signer-admin-storage';

  private readonly storage: LocalStorage;
  private readonly adminStorage: LocalStorage;
  private readonly litNodeClient: LitNodeClientNodeJs;
  private readonly litContracts: LitContracts;
  private readonly toolPolicyRegistryContract: ethers.Contract;
  private readonly delegateeWallet: ethers.Wallet;

  public readonly litNetwork: LitNetwork;

  /**
   * Private constructor for the Delegatee class.
   * @param litNetwork - The Lit network to use.
   * @param storage - An instance of `LocalStorage` for storing delegatee information.
   * @param adminStorage - An instance of `LocalStorage` for storing shared information.
   * @param litNodeClient - An instance of `LitNodeClientNodeJs`.
   * @param litContracts - An instance of `LitContracts`.
   * @param toolPolicyRegistryContract - An instance of the tool policy registry contract.
   * @param delegateeWallet - The wallet used for Delegatee operations.
   */
  private constructor(
    litNetwork: LitNetwork,
    storage: LocalStorage,
    adminStorage: LocalStorage,
    litNodeClient: LitNodeClientNodeJs,
    litContracts: LitContracts,
    toolPolicyRegistryContract: ethers.Contract,
    delegateeWallet: ethers.Wallet
  ) {
    this.litNetwork = litNetwork;
    this.storage = storage;
    this.adminStorage = adminStorage;
    this.litNodeClient = litNodeClient;
    this.litContracts = litContracts;
    this.toolPolicyRegistryContract = toolPolicyRegistryContract;
    this.delegateeWallet = delegateeWallet;
  }

  /**
   * Retrieves or mints a capacity credit for the Delegatee.
   * If a capacity credit is already stored and not expired, it is loaded; otherwise, a new capacity credit is minted.
   *
   * @param litContracts - An instance of `LitContracts`.
   * @param storage - An instance of `LocalStorage` for storing capacity credit information.
   * @returns A promise that resolves to the capacity credit information or `null` if not required.
   */
  private static async getCapacityCredit(
    litContracts: LitContracts,
    storage: LocalStorage
  ) {
    if (requiresCapacityCredit(litContracts)) {
      const capacityCreditInfo = loadCapacityCreditFromStorage(storage);
      if (
        capacityCreditInfo !== null &&
        !isCapacityCreditExpired(
          capacityCreditInfo.mintedAtUtc,
          capacityCreditInfo.daysUntilUTCMidnightExpiration
        )
      ) {
        return capacityCreditInfo;
      }

      const mintMetadata = await mintCapacityCredit(litContracts);
      saveCapacityCreditToStorage(storage, mintMetadata);

      return mintMetadata;
    }

    return null;
  }

  /**
   * Creates an instance of the `Delegatee` class.
   * Initializes the Lit node client, contracts, and capacity credit.
   *
   * @param delegateePrivateKey - Optional. The private key for the Delegatee role.
   * @param agentConfig - Configuration for the agent, including the Lit network and debug mode.
   * @returns A promise that resolves to an instance of the `Delegatee` class.
   * @throws {AwSignerError} If the Lit network is not provided or the private key is missing.
   */
  public static async create(
    delegateePrivateKey?: string,
    { litNetwork, debug = true }: AgentConfig = {}
  ) {
    if (!litNetwork) {
      throw new AwSignerError(
        AwSignerErrorType.DELEGATEE_MISSING_LIT_NETWORK,
        'Lit network not provided'
      );
    }

    const storage = new LocalStorage(Delegatee.DEFAULT_STORAGE_PATH);
    const adminStorage = new LocalStorage(Delegatee.ADMIN_STORAGE_PATH);

    const toolPolicyRegistryConfig = DEFAULT_REGISTRY_CONFIG[litNetwork];

    const provider = new ethers.providers.JsonRpcProvider(
      toolPolicyRegistryConfig.rpcUrl
    );

    const storedPrivateKey = storage.getItem('privateKey');
    const _delegateePrivateKey = delegateePrivateKey || storedPrivateKey;

    if (_delegateePrivateKey === null) {
      throw new AwSignerError(
        AwSignerErrorType.DELEGATEE_MISSING_PRIVATE_KEY,
        'Delegatee private key not provided and not found in storage. Please provide a private key.'
      );
    }

    // Only save if not already stored
    if (!storedPrivateKey) {
      storage.setItem('privateKey', _delegateePrivateKey);
    }

    const delegateeWallet = new ethers.Wallet(_delegateePrivateKey, provider);

    const litNodeClient = new LitNodeClientNodeJs({
      litNetwork,
      debug,
    });
    await litNodeClient.connect();

    const litContracts = new LitContracts({
      signer: delegateeWallet,
      network: litNetwork,
      debug,
    });
    await litContracts.connect();

    // Will mint a Capacity Credit if none exists
    await Delegatee.getCapacityCredit(litContracts, storage);

    return new Delegatee(
      litNetwork,
      storage,
      adminStorage,
      litNodeClient,
      litContracts,
      getPkpToolPolicyRegistryContract(
        toolPolicyRegistryConfig,
        delegateeWallet
      ),
      delegateeWallet
    );
  }

  /**
   * Retrieves all delegated PKPs (Programmable Key Pairs) for the Delegatee.
   * @returns A promise that resolves to an array of `DelegatedPkpInfo` objects.
   * @throws If the tool policy registry contract, delegatee wallet, or Lit contracts are not initialized.
   */
  public async getDelegatedPkps(): Promise<DelegatedPkpInfo[]> {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    if (!this.delegateeWallet) {
      throw new Error('Delegatee wallet not initialized');
    }

    if (!this.litContracts) {
      throw new Error('Lit contracts not initialized');
    }

    // Get token IDs of delegated PKPs
    const tokenIds = await this.toolPolicyRegistryContract.getDelegatedPkps(
      this.delegateeWallet.address
    );

    // For each token ID, get the public key and compute eth address
    const pkps = await Promise.all(
      tokenIds.map(async (tokenId: string) => {
        // Get PKP public key
        const pkpInfo = await this.litContracts.pkpNftContract.read.getPubkey(
          tokenId
        );
        const publicKey = pkpInfo.toString();

        // Compute eth address from public key
        const ethAddress = ethers.utils.computeAddress(publicKey);

        return {
          tokenId: tokenId.toString(),
          ethAddress,
          publicKey,
        };
      })
    );

    return pkps;
  }

  /**
   * Get all registered tools and categorize them based on whether they have policies
   * @param pkpTokenId The token ID of the PKP to get tools for
   * @returns Object containing:
   * - toolsWithPolicies: Array of tools that have policies and match the current network
   * - toolsWithoutPolicies: Array of tools that don't have policies and match the current network
   * - toolsUnknownWithPolicies: Array of tools with policies that aren't in the registry
   * - toolsUnknownWithoutPolicies: Array of tool CIDs without policies that aren't in the registry
   */
  public async getRegisteredToolsForPkp(pkpTokenId: string): Promise<{
    toolsWithPolicies: Array<AwTool<any, any>>;
    toolsWithoutPolicies: Array<AwTool<any, any>>;
    toolsUnknownWithPolicies: UnknownRegisteredToolWithPolicy[];
    toolsUnknownWithoutPolicies: string[];
  }> {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const registeredTools = await getRegisteredTools(
      this.toolPolicyRegistryContract,
      this.litContracts,
      pkpTokenId
    );

    return {
      toolsWithPolicies: registeredTools.toolsWithPolicies
        .filter((tool) => tool.network === this.litNetwork)
        .map((t) => t.tool),
      toolsWithoutPolicies: registeredTools.toolsWithoutPolicies
        .filter((tool) => tool.network === this.litNetwork)
        .map((t) => t.tool),
      toolsUnknownWithPolicies: registeredTools.toolsUnknownWithPolicies,
      toolsUnknownWithoutPolicies: registeredTools.toolsUnknownWithoutPolicies,
    };
  }

  /**
   * Retrieves the policy for a specific tool.
   * @param pkpTokenId - The token ID of the PKP.
   * @param ipfsCid - The IPFS CID of the tool.
   * @returns An object containing the policy and version for the tool.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getToolPolicy(
    pkpTokenId: string,
    ipfsCid: string
  ): Promise<{ policy: string; version: string }> {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    return getToolPolicy(this.toolPolicyRegistryContract, pkpTokenId, ipfsCid);
  }

  public async getToolViaIntent(
    pkpTokenId: string,
    intent: string,
    intentMatcher: IntentMatcher
  ): Promise<IntentMatcherResponse<any>> {
    // Get registered tools
    const { toolsWithPolicies, toolsWithoutPolicies } =
      await this.getRegisteredToolsForPkp(pkpTokenId);

    // Analyze intent and find matching tool
    return intentMatcher.analyzeIntentAndMatchTool(intent, [
      ...toolsWithPolicies,
      ...toolsWithoutPolicies,
    ]);
  }

  public async executeTool(
    params: Omit<JsonExecutionSdkParams, 'sessionSigs'> & { wrappedKeyId?: string }
  ): Promise<ExecuteJsResponse> {
    if (!this.litNodeClient || !this.litContracts || !this.delegateeWallet) {
      throw new Error('Delegatee not properly initialized');
    }

    const capacityCreditInfo = await Delegatee.getCapacityCredit(
      this.litContracts,
      this.storage
    );

    let capacityDelegationAuthSig: AuthSig | undefined;
    if (capacityCreditInfo !== null) {
      capacityDelegationAuthSig = (
        await this.litNodeClient.createCapacityDelegationAuthSig({
          dAppOwnerWallet: this.delegateeWallet,
          capacityTokenId: capacityCreditInfo.capacityTokenId,
          delegateeAddresses: [this.delegateeWallet.address],
          uses: '1',
        })
      ).capacityDelegationAuthSig;
    }

    // If wrappedKeyId is provided, get the wrapped key and add it to the params
    let wrappedKey;
    if (params.wrappedKeyId) {
      wrappedKey = await this.getWrappedKeyById(params.wrappedKeyId);
      // Add the wrapped key to the jsParams
      params.jsParams = {
        ...params.jsParams,
        wrappedKey,
      };
    }

    const sessionSignatures = await this.litNodeClient.getSessionSigs({
      chain: 'ethereum',
      expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
      capabilityAuthSigs:
        capacityDelegationAuthSig !== undefined
          ? [capacityDelegationAuthSig]
          : undefined,
      resourceAbilityRequests: [
        {
          resource: new LitActionResource('*'),
          ability: LIT_ABILITY.LitActionExecution,
        },
        {
          resource: new LitPKPResource('*'),
          ability: LIT_ABILITY.PKPSigning,
        },
        {
          resource: new LitAccessControlConditionResource('*'),
          ability: LIT_ABILITY.AccessControlConditionDecryption,
        },
      ],
      authNeededCallback: async ({
        uri,
        expiration,
        resourceAbilityRequests,
      }) => {
        const toSign = await createSiweMessage({
          uri,
          expiration,
          resources: resourceAbilityRequests,
          walletAddress: await this.delegateeWallet.getAddress(),
          nonce: await this.litNodeClient.getLatestBlockhash(),
          litNodeClient: this.litNodeClient,
        });

        return await generateAuthSig({
          signer: this.delegateeWallet,
          toSign,
        });
      },
    });

    try {
      return this.litNodeClient.executeJs({
        ...params,
        sessionSigs: sessionSignatures,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to execute tool: ${error.message}`);
      }
      throw error;
    }
  }

  public async getCredentials<T>(
    requiredCredentialNames: readonly string[]
  ): Promise<{
    foundCredentials: Partial<CredentialsFor<T>>;
    missingCredentials: string[];
  }> {
    const foundCredentials: Record<string, string> = {};
    const missingCredentials: string[] = [];

    for (const credentialName of requiredCredentialNames) {
      const storedCred = this.storage.getItem(credentialName);
      if (storedCred) {
        foundCredentials[credentialName] = storedCred;
      } else {
        missingCredentials.push(credentialName);
      }
    }

    return {
      foundCredentials: foundCredentials as Partial<CredentialsFor<T>>,
      missingCredentials,
    };
  }

  public async setCredentials<T>(
    credentials: Partial<CredentialsFor<T>>
  ): Promise<void> {
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string') {
        this.storage.setItem(key, value);
      } else {
        throw new Error(
          `Invalid credential value for ${key}: value must be a string`
        );
      }
    }
  }

  public disconnect() {
    this.litNodeClient.disconnect();
  }

  public async getWrappedKeys() {
    return loadWrappedKeysFromStorage(this.adminStorage);
  }

  public async getWrappedKeyById(id: string) {
    const wrappedKey = loadWrappedKeyFromStorage(this.adminStorage, id);
    if (!wrappedKey) {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_WRAPPED_KEY_NOT_FOUND,
        `Wrapped key with id ${id} not found in storage`
      );
    }
    return wrappedKey;
  }
}
