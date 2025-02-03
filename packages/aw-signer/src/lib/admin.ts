import { LitNodeClientNodeJs } from '@lit-protocol/lit-node-client-nodejs';
import {
  AUTH_METHOD_SCOPE,
  AUTH_METHOD_SCOPE_VALUES,
} from '@lit-protocol/constants';
import { LitContracts } from '@lit-protocol/contracts-sdk';
import { ethers } from 'ethers';

import {
  AdminConfig,
  AgentConfig,
  LitNetwork,
  PkpInfo,
  ToolInfoWithDelegateePolicy,
} from './types';
import {
  DEFAULT_REGISTRY_CONFIG,
  getPkpToolRegistryContract,
  getRegisteredToolsAndDelegatees,
} from './utils/pkp-tool-registry';
import { LocalStorage } from './utils/storage';
import { AwSignerError, AwSignerErrorType } from './errors';

type AdminStorageLayout = {
  [ethAddress: string]: {
    privateKey: string;
    pkps: PkpInfo[];
  };
};

/**
 * The `Admin` class is responsible for the ownership of the PKP (Programmable Key Pair),
 * the registration and management of tools, policies, and delegatees.
 */
export class Admin {
  private static readonly DEFAULT_STORAGE_PATH = './.law-signer-admin-storage';
  private static readonly ADMIN_STORAGE_KEY = 'admins';
  // TODO: Add min balance check
  // private static readonly MIN_BALANCE = ethers.utils.parseEther('0.001');

  private readonly storage: LocalStorage;
  private readonly litNodeClient: LitNodeClientNodeJs;
  private readonly litContracts: LitContracts;
  private readonly toolRegistryContract: ethers.Contract;
  private readonly adminWallet: ethers.Wallet;

  public readonly litNetwork: LitNetwork;
  /**
   * Private constructor for the Admin class.
   * @param litNetwork - The Lit network to use.
   * @param litNodeClient - An instance of `LitNodeClientNodeJs`.
   * @param litContracts - An instance of `LitContracts`.
   * @param toolRegistryContract - An instance of the tool policy registry contract.
   * @param adminWallet - The wallet used for Admin operations.
   * @param pkpInfo - Information about the PKP (Programmable Key Pair).
   */
  private constructor(
    storage: LocalStorage,
    litNetwork: LitNetwork,
    litNodeClient: LitNodeClientNodeJs,
    litContracts: LitContracts,
    toolRegistryContract: ethers.Contract,
    adminWallet: ethers.Wallet
  ) {
    this.storage = storage;
    this.litNetwork = litNetwork;
    this.litNodeClient = litNodeClient;
    this.litContracts = litContracts;
    this.toolRegistryContract = toolRegistryContract;
    this.adminWallet = adminWallet;
  }

  private static loadAdminsFromStorage(
    storage: LocalStorage
  ): AdminStorageLayout {
    const adminData = storage.getItem(Admin.ADMIN_STORAGE_KEY);
    if (!adminData) {
      return {};
    }
    return JSON.parse(adminData) as AdminStorageLayout;
  }

  private static saveAdminsToStorage(
    storage: LocalStorage,
    admins: AdminStorageLayout
  ): void {
    storage.setItem(Admin.ADMIN_STORAGE_KEY, JSON.stringify(admins));
  }

  private static loadPkpsFromStorage(
    storage: LocalStorage,
    adminAddress: string
  ): PkpInfo[] {
    const admins = Admin.loadAdminsFromStorage(storage);
    return admins[adminAddress]?.pkps || [];
  }

  private static savePkpsToStorage(
    storage: LocalStorage,
    adminAddress: string,
    pkps: PkpInfo[]
  ): void {
    const admins = Admin.loadAdminsFromStorage(storage);
    if (!admins[adminAddress]) {
      admins[adminAddress] = { privateKey: '', pkps: [] };
    }
    admins[adminAddress].pkps = pkps;
    Admin.saveAdminsToStorage(storage, admins);
  }

  private static async removePkpFromStorage(
    storage: LocalStorage,
    adminAddress: string,
    pkpTokenId: string
  ) {
    const admins = Admin.loadAdminsFromStorage(storage);
    const pkps = admins[adminAddress]?.pkps || [];
    const index = pkps.findIndex((p) => p.info.tokenId === pkpTokenId);

    if (index === -1) {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_PKP_NOT_FOUND,
        `PKP with tokenId ${pkpTokenId} not found in storage`
      );
    }

    pkps.splice(index, 1);
    admins[adminAddress].pkps = pkps;
    Admin.saveAdminsToStorage(storage, admins);
  }

  private static async mintPkp(
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
    { litNetwork, debug = false }: AgentConfig = {}
  ) {
    if (!litNetwork) {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_MISSING_LIT_NETWORK,
        'Lit network not provided'
      );
    }

    const storage = new LocalStorage(Admin.DEFAULT_STORAGE_PATH);

    const toolRegistryConfig = DEFAULT_REGISTRY_CONFIG[litNetwork];

    const provider = new ethers.providers.JsonRpcProvider(
      toolRegistryConfig.rpcUrl
    );

    let adminWallet: ethers.Wallet;
    if (adminConfig.type === 'eoa') {
      if (!adminConfig.privateKey) {
        throw new AwSignerError(
          AwSignerErrorType.ADMIN_MISSING_PRIVATE_KEY,
          'Admin private key not provided. Please provide a private key.'
        );
      }

      adminWallet = new ethers.Wallet(adminConfig.privateKey, provider);

      // Initialize storage for this admin if not already present
      const admins = Admin.loadAdminsFromStorage(storage);
      if (!admins[adminWallet.address]) {
        admins[adminWallet.address] = {
          privateKey: adminConfig.privateKey,
          pkps: [],
        };
        Admin.saveAdminsToStorage(storage, admins);
      }
    } else {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_MULTISIG_NOT_IMPLEMENTED,
        'Multisig admin not implemented, use EOA instead.'
      );
    }

    const litNodeClient = new LitNodeClientNodeJs({
      litNetwork,
      debug,
    });
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
      getPkpToolRegistryContract(toolRegistryConfig, adminWallet),
      adminWallet
    );
  }

  /**
   * Retrieves all PKPs stored in the Admin's (local) storage.
   * @returns An array of PKP metadata.
   */
  public async getPkps() {
    return Admin.loadPkpsFromStorage(this.storage, this.adminWallet.address);
  }

  /**
   * Retrieves a PKP by its token ID.
   * @param tokenId - The token ID of the PKP.
   * @returns A promise that resolves to the PKP metadata.
   * @throws If the PKP is not found in storage.
   */
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

  /**
   * Mints a new PKP and saves the metadata to the Admin's (local) storage.
   * @returns A promise that resolves to the minted PKP metadata.
   * @throws If the PKP minting fails.
   */
  public async mintPkp() {
    const pkps = await this.getPkps();
    const mintMetadata = await Admin.mintPkp(
      this.litContracts,
      this.adminWallet
    );
    pkps.push(mintMetadata);
    Admin.savePkpsToStorage(this.storage, this.adminWallet.address, pkps);

    return mintMetadata;
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

    await Admin.removePkpFromStorage(
      this.storage,
      this.adminWallet.address,
      pkpTokenId
    );

    return receipt;
  }

  /**
   * Allows a tool to be used with the PKP.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param signingScopes - The signing scopes for the tool (default is `SignAnything`).
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the Admin instance is not properly initialized.
   */
  public async registerTool(
    pkpTokenId: string,
    ipfsCid: string,
    options: {
      signingScopes?: AUTH_METHOD_SCOPE_VALUES[];
      enableTools?: boolean;
    } = {}
  ) {
    const {
      signingScopes = [AUTH_METHOD_SCOPE.SignAnything],
      enableTools = true,
    } = options;

    if (!this.litContracts) {
      throw new Error('Not properly initialized');
    }

    const litContractsTxReceipt = await this.litContracts.addPermittedAction({
      ipfsId: ipfsCid,
      authMethodScopes: signingScopes,
      pkpTokenId: (await this.getPkpByTokenId(pkpTokenId)).info.tokenId,
    });

    const toolRegistryContractTx =
      await this.toolRegistryContract.registerTools(
        pkpTokenId,
        [ipfsCid],
        enableTools
      );

    return {
      litContractsTxReceipt,
      toolRegistryContractTxReceipt: await toolRegistryContractTx.wait(),
    };
  }

  /**
   * Removes a tool from the list of a PKP's permitted tools.
   * @param ipfsCid - The IPFS CID of the tool.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the Admin instance is not properly initialized.
   */
  public async removeTool(pkpTokenId: string, ipfsCid: string) {
    if (!this.litContracts || !this.toolRegistryContract) {
      throw new Error('Not properly initialized');
    }

    const revokePermittedActionTx =
      await this.litContracts.pkpPermissionsContractUtils.write.revokePermittedAction(
        (
          await this.getPkpByTokenId(pkpTokenId)
        ).info.tokenId,
        ipfsCid
      );

    const removeToolsTx = await this.toolRegistryContract.removeTools(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [ipfsCid]
    );

    return {
      revokePermittedActionTxReceipt: await revokePermittedActionTx.wait(),
      removeToolsTxReceipt: await removeToolsTx.wait(),
    };
  }

  /**
   * Enables a tool for a given PKP.
   * @param pkpTokenId - The token ID of the PKP.
   * @param toolIpfsCid - The IPFS CID of the tool to be enabled.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async enableTool(pkpTokenId: string, toolIpfsCid: string) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolRegistryContract.enableTools(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [toolIpfsCid]
    );

    return await tx.wait();
  }

  /**
   * Disables a tool for a given PKP.
   * @param pkpTokenId - The token ID of the PKP.
   * @param toolIpfsCid - The IPFS CID of the tool to be disabled.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async disableTool(pkpTokenId: string, toolIpfsCid: string) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolRegistryContract.disableTools(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [toolIpfsCid]
    );

    return await tx.wait();
  }

  /**
   * Checks if a tool is registered for a given PKP.
   * @param pkpTokenId - The token ID of the PKP.
   * @param toolIpfsCid - The IPFS CID of the tool to be checked.
   * @returns A promise that resolves to an object containing:
   * - isRegistered: boolean indicating if the tool is registered
   * - isEnabled: boolean indicating if the tool is enabled
   * @throws If the tool policy registry contract is not initialized.
   */
  public async isToolRegistered(pkpTokenId: string, toolIpfsCid: string) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const [isRegistered, isEnabled] =
      await this.toolRegistryContract.isToolRegistered(
        (
          await this.getPkpByTokenId(pkpTokenId)
        ).info.tokenId,
        toolIpfsCid
      );

    return { isRegistered, isEnabled };
  }

  /**
   * Get a registered tool by its IPFS CID for a given PKP.
   * @param pkpTokenId - The token ID of the PKP.
   * @param toolIpfsCid - The IPFS CID of the tool to be retrieved.
   * @returns A promise that resolves to the tool information.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getRegisteredTool(pkpTokenId: string, toolIpfsCid: string) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const toolInfos = await this.toolRegistryContract.getRegisteredTools(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [toolIpfsCid]
    );

    return toolInfos[0];
  }

  /**
   * Get all registered tools and categorize them based on whether they have policies
   * @returns Object containing
   * - toolsWithPolicies: Object mapping tool IPFS CIDs to their metadata and delegatee policies
   * - toolsWithoutPolicies: Object mapping tool IPFS CIDs to their metadata without policies
   * - toolsUnknownWithPolicies: Object mapping unknown tool IPFS CIDs to their delegatee policies
   * - toolsUnknownWithoutPolicies: Array of tool CIDs without policies that aren't in the registry
   */
  public async getRegisteredToolsAndDelegateesForPkp(pkpTokenId: string) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const registeredTools = await getRegisteredToolsAndDelegatees(
      this.toolRegistryContract,
      this.litContracts,
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId
    );

    return registeredTools;
  }

  /**
   * Retrieves all delegatees for the PKP.
   * @returns An array of delegatee addresses.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getDelegatees(pkpTokenId: string): Promise<string[]> {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    return await this.toolRegistryContract.getDelegatees(
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
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    return await this.toolRegistryContract.isPkpDelegatee(
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
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolRegistryContract.addDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [delegatee]
    );

    return await tx.wait();
  }

  /**
   * Removes a delegatee for the PKP.
   * @param pkpTokenId - The PKP token ID.
   * @param delegatee - The address of the delegatee to remove.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async removeDelegatee(pkpTokenId: string, delegatee: string) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolRegistryContract.removeDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [delegatee]
    );

    return await tx.wait();
  }

  /**
   * Checks if a tool is permitted for a specific delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param toolIpfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @returns A promise that resolves to an object containing isPermitted and isEnabled.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async isToolPermittedForDelegatee(
    pkpTokenId: string,
    toolIpfsCid: string,
    delegatee: string
  ) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const result = await this.toolRegistryContract.isToolPermittedForDelegatee(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      toolIpfsCid,
      ethers.utils.getAddress(delegatee)
    );

    return {
      isPermitted: result[0],
      isEnabled: result[1],
    };
  }

  /**
   * Gets all tools that are permitted for a specific delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param delegatee - The address of the delegatee.
   * @returns A promise that resolves to an array of ToolInfoWithDelegateePolicy objects permitted for the delegatee.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getPermittedToolsForDelegatee(
    pkpTokenId: string,
    delegatee: string
  ): Promise<ToolInfoWithDelegateePolicy[]> {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    return this.toolRegistryContract.getPermittedToolsForDelegatee(
      (await this.getPkpByTokenId(pkpTokenId)).info.tokenId,
      ethers.utils.getAddress(delegatee)
    );
  }

  /**
   * Permits a tool for a specific delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param toolIpfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async permitToolForDelegatee(
    pkpTokenId: string,
    toolIpfsCid: string,
    delegatee: string
  ) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolRegistryContract.permitToolsForDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [toolIpfsCid],
      [delegatee]
    );

    return await tx.wait();
  }

  /**
   * Unpermits a tool for a specific delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param toolIpfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async unpermitToolForDelegatee(
    pkpTokenId: string,
    toolIpfsCid: string,
    delegatee: string
  ) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolRegistryContract.unpermitToolsForDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [toolIpfsCid],
      [delegatee]
    );

    return await tx.wait();
  }

  /**
   * Retrieves the policy for a specific tool and delegatee.
   * @param pkpTokenId - The token ID of the PKP.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @returns An object containing the policy IPFS CID and enabled status for the tool.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getToolPolicyForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string
  ): Promise<{ policyIpfsCid: string; enabled: boolean }> {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const result = await this.toolRegistryContract.getToolPoliciesForDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [ipfsCid],
      [delegatee]
    );

    return result[0];
  }

  /**
   * Sets or updates a policy for a specific tool and delegatee.
   * @param pkpTokenId - The token ID of the PKP.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @param policyIpfsCid - The IPFS CID of the policy to be set.
   * @param enablePolicies - Whether to enable the policy after setting it.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async setToolPolicyForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string,
    policyIpfsCid: string,
    enablePolicies: boolean
  ) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolRegistryContract.setToolPoliciesForDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [ipfsCid],
      [delegatee],
      [policyIpfsCid],
      enablePolicies
    );

    return await tx.wait();
  }

  /**
   * Removes a policy for a specific tool and delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async removeToolPolicyForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string
  ) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolRegistryContract.removeToolPoliciesForDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [ipfsCid],
      [delegatee]
    );

    return await tx.wait();
  }

  /**
   * Enables a policy for a specific tool and delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async enableToolPolicyForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string
  ) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolRegistryContract.enableToolPoliciesForDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [ipfsCid],
      [delegatee]
    );

    return await tx.wait();
  }

  /**
   * Disables a policy for a specific tool and delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async disableToolPolicyForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string
  ) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx = await this.toolRegistryContract.disableToolPoliciesForDelegatees(
      (
        await this.getPkpByTokenId(pkpTokenId)
      ).info.tokenId,
      [ipfsCid],
      [delegatee]
    );

    return await tx.wait();
  }

  /**
   * Retrieves a specific policy parameter for a tool and delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @param parameterName - The name of the policy parameter.
   * @returns A promise that resolves to the policy parameter value.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getToolPolicyParameterForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string,
    parameterName: string
  ) {
    return this.getToolPolicyParametersForDelegatee(
      pkpTokenId,
      ipfsCid,
      delegatee,
      [parameterName]
    );
  }

  /**
   * Retrieves multiple policy parameters for a tool and delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @param parameterNames - An array of policy parameter names.
   * @returns A promise that resolves to an array of tuples containing policy parameter names and values.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getToolPolicyParametersForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string,
    parameterNames: string[]
  ): Promise<{ name: string; value: string }[]> {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const parameterValues =
      await this.toolRegistryContract.getToolPolicyParameters(
        (
          await this.getPkpByTokenId(pkpTokenId)
        ).info.tokenId,
        ipfsCid,
        delegatee,
        parameterNames
      );

    return parameterValues;
  }

  /**
   * Retrieves all policy parameters for a tool and delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @returns A promise that resolves to an array of all policy parameter names and values.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getAllToolPolicyParametersForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string
  ) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const parameters =
      await this.toolRegistryContract.getAllToolPolicyParameters(
        (
          await this.getPkpByTokenId(pkpTokenId)
        ).info.tokenId,
        ipfsCid,
        delegatee
      );

    return parameters;
  }

  /**
   * Sets multiple policy parameters for a tool and delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @param parameterNames - An array of policy parameter names.
   * @param parameterValues - An array of policy parameter values.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async setToolPolicyParametersForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string,
    parameterNames: string[],
    parameterValues: any[]
  ) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx =
      await this.toolRegistryContract.setToolPolicyParametersForDelegatee(
        (
          await this.getPkpByTokenId(pkpTokenId)
        ).info.tokenId,
        ipfsCid,
        delegatee,
        parameterNames,
        parameterValues
      );

    return await tx.wait();
  }

  /**
   * Removes multiple policy parameters for a tool and delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @param parameterNames - An array of policy parameter names to remove.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async removeToolPolicyParametersForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string,
    parameterNames: string[]
  ) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const tx =
      await this.toolRegistryContract.removeToolPolicyParametersForDelegatee(
        (
          await this.getPkpByTokenId(pkpTokenId)
        ).info.tokenId,
        ipfsCid,
        delegatee,
        parameterNames
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
