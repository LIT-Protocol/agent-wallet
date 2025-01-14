import { LitNodeClientNodeJs } from '@lit-protocol/lit-node-client-nodejs';
import {
  AUTH_METHOD_SCOPE,
  AUTH_METHOD_SCOPE_VALUES,
  LIT_ABILITY,
} from '@lit-protocol/constants';
import { LitContracts } from '@lit-protocol/contracts-sdk';
import { EthWalletProvider } from "@lit-protocol/lit-auth-client";
import { ethers } from 'ethers';

import {
  AdminConfig,
  AgentConfig,
  LitNetwork,
  UnknownRegisteredToolWithPolicy,
  WrappedKeyInfo,
} from './types';
import {
  DEFAULT_REGISTRY_CONFIG,
  getPkpToolPolicyRegistryContract,
  getRegisteredTools,
  getToolPolicy,
} from './utils/pkp-tool-registry';
import { LocalStorage } from './utils/storage';
import { loadPkpsFromStorage, mintPkp, savePkpsToStorage } from './utils/pkp';
import { mintWrappedKey, loadWrappedKeysFromStorage, loadWrappedKeyFromStorage, removeWrappedKeyFromStorage } from './utils/wrapped-key';
import { LitPKPResource } from '@lit-protocol/auth-helpers';
import { LitAccessControlConditionResource, LitActionResource } from '@lit-protocol/auth-helpers';
import { AwSignerError, AwSignerErrorType } from './errors';
import { AwTool } from '@lit-protocol/aw-tool';

/**
 * The `Admin` class is responsible for managing the Admin role in the Lit Protocol.
 * It handles tasks such as transferring ownership, permitting tools, managing policies, and managing delegatees.
 */
export class Admin {
  private static readonly DEFAULT_STORAGE_PATH = './.aw-signer-admin-storage';
  // TODO: Add min balance check
  // private static readonly MIN_BALANCE = ethers.utils.parseEther('0.001');

  private readonly storage: LocalStorage;
  private readonly litNodeClient: any;
  private readonly litContracts: LitContracts;
  private readonly toolPolicyRegistryContract: ethers.Contract;
  private readonly adminWallet: ethers.Wallet;

  public readonly litNetwork: LitNetwork;
  /**
   * Private constructor for the Admin class.
   * @param litNetwork - The Lit network to use.
   * @param litNodeClient - An instance of `LitNodeClientNodeJs`.
   * @param litContracts - An instance of `LitContracts`.
   * @param toolPolicyRegistryContract - An instance of the tool policy registry contract.
   * @param adminWallet - The wallet used for Admin operations.
   * @param pkpInfo - Information about the PKP (Programmable Key Pair).
   */
  private constructor(
    storage: LocalStorage,
    litNetwork: LitNetwork,
    litNodeClient: any,
    litContracts: LitContracts,
    toolPolicyRegistryContract: ethers.Contract,
    adminWallet: ethers.Wallet
  ) {
    this.storage = storage;
    this.litNetwork = litNetwork;
    this.litNodeClient = litNodeClient;
    this.litContracts = litContracts;
    this.toolPolicyRegistryContract = toolPolicyRegistryContract;
    this.adminWallet = adminWallet;
  }

  private static async removePkpFromStorage(
    storage: LocalStorage,
    pkpTokenId: string
  ) {
    const pkps = loadPkpsFromStorage(storage);
    const index = pkps.findIndex((p) => p.info.tokenId === pkpTokenId);

    if (index === -1) {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_PKP_NOT_FOUND,
        `PKP with tokenId ${pkpTokenId} not found in storage`
      );
    }

    pkps.splice(index, 1);
    savePkpsToStorage(storage, pkps);
  }

  /**
   * Creates an instance of the `Admin` class.
   * Initializes the Lit node client, contracts, and PKP.
   *
   * @param adminConfig - Configuration for the Admin role.
   * @param agentConfig - Configuration for the agent, including the Lit network and debug mode.
   * @returns A promise that resolves to an instance of the `Admin` class.
   * @throws {AwSignerError} If the Lit network is not provided or the private key is missing.
   */
  public static async create(
    adminConfig: AdminConfig,
    { litNetwork, debug = true }: AgentConfig = {}
  ) {
    if (!litNetwork) {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_MISSING_LIT_NETWORK,
        'Lit network not provided'
      );
    }

    const storage = new LocalStorage(Admin.DEFAULT_STORAGE_PATH);

    const toolPolicyRegistryConfig = DEFAULT_REGISTRY_CONFIG[litNetwork];

    const provider = new ethers.providers.JsonRpcProvider(
      toolPolicyRegistryConfig.rpcUrl
    );

    let adminWallet: ethers.Wallet;
    if (adminConfig.type === 'eoa') {
      const storedPrivateKey = storage.getItem('privateKey');
      const adminPrivateKey = adminConfig.privateKey || storedPrivateKey;

      if (adminPrivateKey === null) {
        throw new AwSignerError(
          AwSignerErrorType.ADMIN_MISSING_PRIVATE_KEY,
          'Admin private key not provided and not found in storage. Please provide a private key.'
        );
      }

      // Only save if not already stored
      if (!storedPrivateKey) {
        storage.setItem('privateKey', adminPrivateKey);
      }

      adminWallet = new ethers.Wallet(adminPrivateKey, provider);
    } else {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_MULTISIG_NOT_IMPLEMENTED,
        'Multisig admin not implemented, use EOA instead.'
      );
    }

    const litNodeClient = new LitNodeClientNodeJs({
      litNetwork,
      debug,
    }) as any;
    await litNodeClient.connect();

    const litContracts = new LitContracts({
      signer: adminWallet,
      network: litNetwork,
      debug,
    });
    await litContracts.connect();

    return new Admin(
      storage,
      litNetwork,
      litNodeClient,
      litContracts,
      getPkpToolPolicyRegistryContract(toolPolicyRegistryConfig, adminWallet),
      adminWallet
    );
  }

  public async getPkps() {
    return loadPkpsFromStorage(this.storage);
  }

  public async getPkpByTokenId(tokenId: string) {
    const pkps = await this.getPkps();
    const pkp = pkps.find((p) => p.info.tokenId === tokenId);
    if (!pkp) {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_PKP_NOT_FOUND,
        `PKP with tokenId ${tokenId} not found in storage`
      );
    }

    return pkp;
  }

  public async mintPkp() {
    const pkps = await this.getPkps();
    const mintMetadata = await mintPkp(this.litContracts, this.adminWallet);
    pkps.push(mintMetadata);
    savePkpsToStorage(this.storage, pkps);

    return mintMetadata;
  }

  /**
   * Gets all wrapped keys from storage.
   * @returns A promise that resolves to an array of wrapped keys.
   */
  public async getWrappedKeys(): Promise<WrappedKeyInfo[]> {
    return loadWrappedKeysFromStorage(this.storage);
  }

  /**
   * Gets a wrapped key by its ID.
   * @param id - The ID of the wrapped key.
   * @returns A promise that resolves to the wrapped key.
   * @throws If the wrapped key is not found.
   */
  public async getWrappedKeyById(id: string): Promise<WrappedKeyInfo> {
    const wrappedKey = loadWrappedKeyFromStorage(this.storage, id);
    if (!wrappedKey) {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_WRAPPED_KEY_NOT_FOUND,
        `Wrapped key with id ${id} not found in storage`
      );
    }
    return wrappedKey;
  }

  /**
   * Removes a wrapped key from storage.
   * @param id - The ID of the wrapped key to remove.
   * @returns A promise that resolves to the removed wrapped key.
   * @throws If the wrapped key is not found.
   */
  public async removeWrappedKey(id: string): Promise<WrappedKeyInfo> {
    const wrappedKey = await this.getWrappedKeyById(id);
    removeWrappedKeyFromStorage(this.storage, id);
    return wrappedKey;
  }

  /**
   * Mints a new wrapped key for a PKP.
   * @param pkpTokenId - The token ID of the PKP.
   * @returns A promise that resolves to the minted wrapped key.
   */
  public async mintWrappedKey(pkpTokenId: string): Promise<WrappedKeyInfo> {
    const pkp = await this.getPkpByTokenId(pkpTokenId);
    const authMethod = await EthWalletProvider.authenticate({
      signer: this.adminWallet,
      litNodeClient: this.litNodeClient,
    });
    const pkpSessionSigs = await this.litNodeClient.getPkpSessionSigs({
      pkpPublicKey: pkp.info.publicKey,
      chain: "ethereum",
      authMethods: [authMethod],
      expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
      resourceAbilityRequests: [
        {
          resource: new LitActionResource("*"),
          ability: LIT_ABILITY.LitActionExecution,
        },
        {
          resource: new LitPKPResource("*"),
          ability: LIT_ABILITY.PKPSigning,
        },
        { 
          resource: new LitAccessControlConditionResource("*"),
          ability: LIT_ABILITY.AccessControlConditionDecryption,
        }
      ],
    });

    return mintWrappedKey(this.litNodeClient, pkpSessionSigs, this.storage, pkpTokenId);
  }

  /**
   * Transfers ownership of the PKP to a new owner.
   * @param newOwner - The address of the new owner.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the Admin instance is not properly initialized.
   */
  public async transferPkpOwnership(pkpTokenId: string, newOwner: string) {
    if (!this.litContracts) {
      throw new Error('Not properly initialized');
    }

    const pkp = await this.getPkpByTokenId(pkpTokenId);
    const tx = await this.litContracts.pkpNftContract.write[
      'safeTransferFrom(address,address,uint256)'
    ](this.adminWallet.address, newOwner, pkp.info.tokenId);

    const receipt = await tx.wait();
    if (receipt.status === 0) {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_PKP_TRANSFER_FAILED,
        'PKP transfer failed'
      );
    }

    await Admin.removePkpFromStorage(this.storage, pkpTokenId);

    return receipt;
  }

  /**
   * Permits a tool to be used with the PKP.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param signingScopes - The signing scopes for the tool (default is `SignAnything`).
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the Admin instance is not properly initialized.
   */
  public async permitTool(
    pkpTokenId: string,
    ipfsCid: string,
    signingScopes: AUTH_METHOD_SCOPE_VALUES[] = [AUTH_METHOD_SCOPE.SignAnything]
  ) {
    if (!this.litContracts) {
      throw new Error('Not properly initialized');
    }

    return this.litContracts.addPermittedAction({
      ipfsId: ipfsCid,
      authMethodScopes: signingScopes,
      pkpTokenId: (await this.getPkpByTokenId(pkpTokenId)).info.tokenId,
    });
  }

  /**
   * Removes a tool from the list of permitted tools.
   * @param ipfsCid - The IPFS CID of the tool.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the Admin instance is not properly initialized.
   */
  public async removeTool(pkpTokenId: string, ipfsCid: string) {
    if (!this.litContracts) {
      throw new Error('Not properly initialized');
    }

    return this.litContracts.pkpPermissionsContractUtils.write.revokePermittedAction(
      (await this.getPkpByTokenId(pkpTokenId)).info.tokenId,
      ipfsCid
    );
  }

  /**

   * Get all registered tools and categorize them based on whether they have policies
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
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId
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

    return getToolPolicy(
      this.toolPolicyRegistryContract,
      (await this.getPkpByTokenId(pkpTokenId)).info.tokenId,
      ipfsCid
    );
  }

  /**
   * Sets or updates a policy for a specific tool.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param policy - The policy bytes (must be ABI encoded).
   * @param version - The version of the policy.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async setToolPolicy(
    pkpTokenId: string,
    ipfsCid: string,
    policy: string,
    version: string
  ) {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolPolicyRegistryContract.setToolPolicy(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      ipfsCid,
      policy,
      version
    );

    return await tx.wait();
  }

  /**
   * Removes the policy for a specific tool.
   * @param ipfsCid - The IPFS CID of the tool.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async removeToolPolicy(pkpTokenId: string, ipfsCid: string) {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolPolicyRegistryContract.removeToolPolicy(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      ipfsCid
    );

    return await tx.wait();
  }

  /**
   * Retrieves all delegatees for the PKP.
   * @returns An array of delegatee addresses.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getDelegatees(pkpTokenId: string): Promise<string[]> {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    return await this.toolPolicyRegistryContract.getDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId
    );
  }

  /**
   * Checks if an address is a delegatee for the PKP.
   * @param delegatee - The address to check.
   * @returns A promise that resolves to a boolean indicating whether the address is a delegatee.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async isDelegatee(pkpTokenId: string, delegatee: string) {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    return await this.toolPolicyRegistryContract.isDelegateeOf(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      ethers.utils.getAddress(delegatee)
    );
  }

  /**
   * Adds a delegatee for the PKP.
   * @param delegatee - The address to add as a delegatee.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async addDelegatee(pkpTokenId: string, delegatee: string) {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolPolicyRegistryContract.addDelegatee(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      delegatee
    );

    return await tx.wait();
  }

  /**
   * Removes a delegatee for the PKP.
   * @param delegatee - The address to remove as a delegatee.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async removeDelegatee(pkpTokenId: string, delegatee: string) {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolPolicyRegistryContract.removeDelegatee(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      delegatee
    );

    return await tx.wait();
  }

  /**
   * Adds multiple delegatees for the PKP in a single transaction.
   * @param delegatees - An array of addresses to add as delegatees.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async batchAddDelegatees(pkpTokenId: string, delegatees: string[]) {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolPolicyRegistryContract.batchAddDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      delegatees
    );

    return await tx.wait();
  }

  /**
   * Removes multiple delegatees for the PKP in a single transaction.
   * @param delegatees - An array of addresses to remove as delegatees.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async batchRemoveDelegatees(pkpTokenId: string, delegatees: string[]) {
    if (!this.toolPolicyRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolPolicyRegistryContract.batchRemoveDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      delegatees
    );

    return await tx.wait();
  }

  /**
   * Disconnects the Lit node client.
   */
  public disconnect() {
    this.litNodeClient.disconnect();
  }
}
