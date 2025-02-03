import { LitContracts } from '@lit-protocol/contracts-sdk';
import { LitNodeClientNodeJs } from '@lit-protocol/lit-node-client-nodejs';
import {
  AuthSig,
  ExecuteJsResponse,
  JsonExecutionSdkParams,
} from '@lit-protocol/types';
import {
  createSiweMessage,
  generateAuthSig,
  LitActionResource,
  LitPKPResource,
} from '@lit-protocol/auth-helpers';
import { LIT_ABILITY } from '@lit-protocol/constants';
import { ethers } from 'ethers';

import type {
  LitNetwork,
  AgentConfig,
  CredentialStore,
  CredentialsFor,
  DelegatedPkpInfo,
  IntentMatcher,
  IntentMatcherResponse,
  CapacityCreditInfo,
} from './types';
import {
  isCapacityCreditExpired,
  mintCapacityCredit,
  requiresCapacityCredit,
} from './utils/capacity-credit';
import { LocalStorage } from './utils/storage';
import { AwSignerError, AwSignerErrorType } from './errors';
import {
  DEFAULT_REGISTRY_CONFIG,
  getPkpToolRegistryContract,
  getPermittedToolsForDelegatee,
} from './utils/pkp-tool-registry';

type DelegateeStorageLayout = {
  [ethAddress: string]: {
    privateKey: string;
    capacityCredit?: CapacityCreditInfo;
    credentials?: {
      [credentialName: string]: string;
    };
  };
};

/**
 * The `Delegatee` class is responsible for executing tools on behalf of the PKP Admin.
 * They are limited to the tools and policies that the PKP Admin has permitted. The class
 * manages the delegatee's authentication and wallet, retrieves permitted tools and their
 * policies, executes tools within permitted boundaries, manages tool-specific credentials,
 * and handles capacity credits for execution. It provides secure access to authorized tools
 * while enforcing policy constraints set by the PKP Admin.
 */
export class Delegatee implements CredentialStore {
  private static readonly DEFAULT_STORAGE_PATH =
    './.law-signer-delegatee-storage';
  private static readonly DELEGATEE_STORAGE_KEY = 'delegatees';

  private readonly storage: LocalStorage;
  private readonly litNodeClient: LitNodeClientNodeJs;
  private readonly litContracts: LitContracts;
  private readonly toolRegistryContract: ethers.Contract;
  private readonly delegateeWallet: ethers.Wallet;

  public readonly litNetwork: LitNetwork;

  /**
   * Private constructor for the Delegatee class.
   * @param litNetwork - The Lit network to use.
   * @param storage - An instance of `LocalStorage` for storing delegatee information.
   * @param litNodeClient - An instance of `LitNodeClientNodeJs`.
   * @param litContracts - An instance of `LitContracts`.
   * @param toolRegistryContract - An instance of the tool policy registry contract.
   * @param delegateeWallet - The wallet used for Delegatee operations.
   */
  private constructor(
    litNetwork: LitNetwork,
    storage: LocalStorage,
    litNodeClient: LitNodeClientNodeJs,
    litContracts: LitContracts,
    toolRegistryContract: ethers.Contract,
    delegateeWallet: ethers.Wallet
  ) {
    this.litNetwork = litNetwork;
    this.storage = storage;
    this.litNodeClient = litNodeClient;
    this.litContracts = litContracts;
    this.toolRegistryContract = toolRegistryContract;
    this.delegateeWallet = delegateeWallet;
  }

  private static loadDelegateesFromStorage(
    storage: LocalStorage
  ): DelegateeStorageLayout {
    const delegateeData = storage.getItem(Delegatee.DELEGATEE_STORAGE_KEY);
    if (!delegateeData) {
      return {};
    }
    return JSON.parse(delegateeData) as DelegateeStorageLayout;
  }

  private static saveDelegateesToStorage(
    storage: LocalStorage,
    delegatees: DelegateeStorageLayout
  ): void {
    storage.setItem(
      Delegatee.DELEGATEE_STORAGE_KEY,
      JSON.stringify(delegatees)
    );
  }

  /**
   * Retrieves or mints a capacity credit for the Delegatee.
   * If a capacity credit is already stored and not expired, it is loaded; otherwise, a new capacity credit is minted.
   *
   * @param litContracts - An instance of `LitContracts`.
   * @param storage - An instance of `LocalStorage` for storing capacity credit information.
   * @param delegateeAddress - The address of the delegatee.
   * @returns A promise that resolves to the capacity credit information or `null` if not required.
   */
  private static async getCapacityCredit(
    litContracts: LitContracts,
    storage: LocalStorage,
    delegateeAddress: string
  ) {
    if (requiresCapacityCredit(litContracts)) {
      const delegatees = Delegatee.loadDelegateesFromStorage(storage);
      const capacityCreditInfo =
        delegatees[delegateeAddress]?.capacityCredit || null;

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

      // Update storage with new capacity credit
      if (!delegatees[delegateeAddress]) {
        delegatees[delegateeAddress] = { privateKey: '' };
      }
      delegatees[delegateeAddress].capacityCredit = mintMetadata;
      Delegatee.saveDelegateesToStorage(storage, delegatees);

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
    { litNetwork, debug = false }: AgentConfig = {}
  ) {
    if (!litNetwork) {
      throw new AwSignerError(
        AwSignerErrorType.DELEGATEE_MISSING_LIT_NETWORK,
        'Lit network not provided'
      );
    }

    const storage = new LocalStorage(Delegatee.DEFAULT_STORAGE_PATH);

    const toolPolicyRegistryConfig = DEFAULT_REGISTRY_CONFIG[litNetwork];

    const provider = new ethers.providers.JsonRpcProvider(
      toolPolicyRegistryConfig.rpcUrl
    );

    // Create temporary wallet to get address for storage lookup
    const tempWallet = delegateePrivateKey
      ? new ethers.Wallet(delegateePrivateKey)
      : null;
    const delegatees = Delegatee.loadDelegateesFromStorage(storage);
    const delegateeData = tempWallet ? delegatees[tempWallet.address] : null;

    const _delegateePrivateKey =
      delegateePrivateKey || delegateeData?.privateKey;

    if (_delegateePrivateKey === null || _delegateePrivateKey === undefined) {
      throw new AwSignerError(
        AwSignerErrorType.DELEGATEE_MISSING_PRIVATE_KEY,
        'Delegatee private key not provided and not found in storage. Please provide a private key.'
      );
    }

    const delegateeWallet = new ethers.Wallet(_delegateePrivateKey, provider);

    // Save delegatee data if not already stored
    if (!delegateeData) {
      delegatees[delegateeWallet.address] = {
        privateKey: _delegateePrivateKey,
      };
      Delegatee.saveDelegateesToStorage(storage, delegatees);
    }

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
    await Delegatee.getCapacityCredit(
      litContracts,
      storage,
      delegateeWallet.address
    );

    return new Delegatee(
      litNetwork,
      storage,
      litNodeClient,
      litContracts,
      getPkpToolRegistryContract(toolPolicyRegistryConfig, delegateeWallet),
      delegateeWallet
    );
  }

  /**
   * Retrieves all delegated PKPs (Programmable Key Pairs) for the Delegatee.
   * @returns A promise that resolves to an array of `DelegatedPkpInfo` objects.
   * @throws If the tool policy registry contract, delegatee wallet, or Lit contracts are not initialized.
   */
  public async getDelegatedPkps(): Promise<DelegatedPkpInfo[]> {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    if (!this.delegateeWallet) {
      throw new Error('Delegatee wallet not initialized');
    }

    if (!this.litContracts) {
      throw new Error('Lit contracts not initialized');
    }

    // Get token IDs of delegated PKPs
    const tokenIds = await this.toolRegistryContract.getDelegatedPkps(
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
          tokenId: ethers.utils.hexlify(tokenId),
          ethAddress,
          publicKey,
        };
      })
    );

    return pkps;
  }

  /**
   * Get all registered tools and categorize them based on whether they have policies
   * @returns Object containing:
   * - toolsWithPolicies: Object mapping tool IPFS CIDs to their metadata and delegatee policies
   * - toolsWithoutPolicies: Array of tools that don't have policies
   * - toolsUnknownWithPolicies: Object mapping unknown tool IPFS CIDs to their delegatee policies
   * - toolsUnknownWithoutPolicies: Array of tool CIDs without policies that aren't in the registry
   */
  public async getPermittedToolsForPkp(pkpTokenId: string) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    return getPermittedToolsForDelegatee(
      this.toolRegistryContract,
      pkpTokenId,
      this.delegateeWallet.address
    );
  }

  /**
   * Retrieves the policy for a specific tool.
   * @param pkpTokenId - The token ID of the PKP.
   * @param ipfsCid - The IPFS CID of the tool.
   * @returns An object containing the policy and version for the tool.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getToolPolicy(pkpTokenId: string, ipfsCid: string) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const results =
      await this.toolRegistryContract.getToolPoliciesForDelegatees(
        pkpTokenId,
        [ipfsCid],
        [this.delegateeWallet.address]
      );

    return results[0];
  }

  /**
   * Matches a user's intent to an appropriate permitted tool.
   * @param pkpTokenId - The token ID of the PKP.
   * @param intent - The user's intent string.
   * @param intentMatcher - The intent matcher implementation to use.
   * @returns A promise that resolves to the matched tool and any extracted parameters.
   * @throws If no matching tool is found or if the tool is not permitted.
   */
  public async getToolViaIntent(
    pkpTokenId: string,
    intent: string,
    intentMatcher: IntentMatcher
  ): Promise<IntentMatcherResponse<any>> {
    // Get registered tools
    const { toolsWithPolicies, toolsWithoutPolicies } =
      await this.getPermittedToolsForPkp(pkpTokenId);

    // Analyze intent and find matching tool
    return intentMatcher.analyzeIntentAndMatchTool(intent, [
      ...Object.values(toolsWithPolicies),
      ...Object.values(toolsWithoutPolicies),
    ]);
  }

  /**
   * Executes a tool with the provided parameters.
   * @param params - The parameters for tool execution, excluding session signatures.
   * @returns A promise that resolves to the tool execution response.
   * @throws If the execution fails or if the delegatee is not properly initialized.
   */
  public async executeTool(
    params: Omit<JsonExecutionSdkParams, 'sessionSigs'>
  ): Promise<ExecuteJsResponse> {
    if (!this.litNodeClient || !this.litContracts || !this.delegateeWallet) {
      throw new Error('Delegatee not properly initialized');
    }

    const capacityCreditInfo = await Delegatee.getCapacityCredit(
      this.litContracts,
      this.storage,
      this.delegateeWallet.address
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

  /**
   * Retrieves stored credentials required by a tool.
   * @param requiredCredentialNames - Names of the required credentials.
   * @returns Object containing found credentials and list of any missing credentials.
   */
  public async getCredentials<T>(
    requiredCredentialNames: readonly string[]
  ): Promise<{
    foundCredentials: Partial<CredentialsFor<T>>;
    missingCredentials: string[];
  }> {
    const delegatees = Delegatee.loadDelegateesFromStorage(this.storage);
    const storedCredentials =
      delegatees[this.delegateeWallet.address]?.credentials || {};

    const foundCredentials: Record<string, string> = {};
    const missingCredentials: string[] = [];

    for (const credentialName of requiredCredentialNames) {
      const storedCred = storedCredentials[credentialName];
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

  /**
   * Stores credentials for future tool executions.
   * @param credentials - Object containing credential key-value pairs to store.
   * @throws If any credential value is not a string.
   */
  public async setCredentials<T>(
    credentials: Partial<CredentialsFor<T>>
  ): Promise<void> {
    const delegatees = Delegatee.loadDelegateesFromStorage(this.storage);
    if (!delegatees[this.delegateeWallet.address]) {
      delegatees[this.delegateeWallet.address] = {
        privateKey: this.delegateeWallet.privateKey.toString(),
      };
    }

    // Initialize credentials object if it doesn't exist
    if (!delegatees[this.delegateeWallet.address].credentials) {
      delegatees[this.delegateeWallet.address].credentials = {};
    }

    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string') {
        delegatees[this.delegateeWallet.address].credentials![key] = value;
      } else {
        throw new Error(
          `Invalid credential value for ${key}: value must be a string`
        );
      }
    }

    Delegatee.saveDelegateesToStorage(this.storage, delegatees);
  }

  /**
   * Disconnects the Lit node client.
   */
  public disconnect() {
    this.litNodeClient.disconnect();
  }
}
