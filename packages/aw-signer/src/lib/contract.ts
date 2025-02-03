import { ethers } from 'ethers';
import {
  DEFAULT_REGISTRY_CONFIG,
  getRegisteredToolsAndDelegatees,
  PKP_TOOL_REGISTRY_ABI,
  getPermittedToolsForDelegatee
} from './utils/pkp-tool-registry';
import {
  InitError,
  LIT_ABILITY,
  METAMASK_CHAIN_INFO_BY_NETWORK,
  RPC_URL_BY_NETWORK,
} from '@lit-protocol/constants';
import { AuthSig, ExecuteJsResponse, JsonExecutionSdkParams, LIT_NETWORKS_KEYS } from '@lit-protocol/types';
import { isBrowser, isNode } from '@lit-protocol/misc';
import { LitContracts } from '@lit-protocol/contracts-sdk';
import { getTokenIdByPkpEthAddress } from './utils/pubkey-router';
import { AwSignerErrorType } from './errors';
import { DelegatedPkpInfo, IntentMatcher, IntentMatcherResponse, PkpInfo, ToolInfoWithDelegateePolicy } from './types';
import { AwSignerError } from './errors';
import {
  AUTH_METHOD_SCOPE,
  AUTH_METHOD_SCOPE_VALUES,
} from '@lit-protocol/constants';
import { LogManager, Logger } from '@lit-protocol/logger';
import { LIT_NETWORK } from '@lit-protocol/constants';
import { createSiweMessage, generateAuthSig, LitActionResource, LitPKPResource, LitResourceAbilityRequest } from '@lit-protocol/auth-helpers';
import { mintCapacityCredit } from './utils/capacity-credit';
import { LitNodeClientNodeJs } from '@lit-protocol/lit-node-client-nodejs';

export class PkpToolRegistryContract {
  litNetwork: LIT_NETWORKS_KEYS;
  rpc: string;
  signer: ethers.Signer | ethers.Wallet | undefined;
  privateKey: string | undefined;
  options?: {
    storeOrUseStorageKey?: boolean;
  };
  provider: ethers.providers.StaticJsonRpcProvider | any;
  debug = false;
  public toolRegistryContract: {
    read: ethers.Contract;
    write: ethers.Contract;
  };
  connected = false;
  litContracts: LitContracts | undefined;
  static logger: Logger = LogManager.Instance.get('pkp-tool-registry-sdk');

  constructor(args?: {
    litNetwork?: LIT_NETWORKS_KEYS;
    rpc?: string | any;
    signer?: ethers.Signer | ethers.Wallet;
    privateKey?: string | undefined;
    options?: {
      storeOrUseStorageKey?: boolean;
    };
    provider?: ethers.providers.JsonRpcProvider;
    debug?: boolean;
  }) {
    this.litNetwork = args?.litNetwork || LIT_NETWORK.DatilDev;
    this.rpc = args?.rpc || RPC_URL_BY_NETWORK[this.litNetwork];
    this.signer = args?.signer;
    this.privateKey = args?.privateKey;
    this.options = args?.options;
    this.provider = args?.provider;
    this.toolRegistryContract = {} as any;
  }

  log = (...args: any) => {
    if (this.debug) {
      PkpToolRegistryContract.logger.debug(...args);
    }
  };

  connect = async () => {
    // =======================================
    //          SETTING UP PROVIDER
    // =======================================

    // -------------------------------------------------
    //          (Browser) Setting up Provider
    // -------------------------------------------------
    let wallet;
    let SETUP_DONE = false;

    if (this.provider) {
      this.log('Using provided provider');
    } else if (isBrowser() && !this.signer) {
      this.log("----- We're in the browser! -----");

      const web3Provider = window.ethereum;

      if (!web3Provider) {
        const msg =
          'No web3 provider found. Please install Brave, MetaMask or another web3 provider.';
        alert(msg);
        throw new InitError(
          {
            info: {
              web3Provider,
            },
          },
          msg
        );
      }

      function _decimalToHex(decimal: number): string {
        return '0x' + decimal.toString(16);
      }

      const chainInfo = METAMASK_CHAIN_INFO_BY_NETWORK[this.litNetwork];

      const metamaskChainInfo = {
        ...chainInfo,
        chainId: _decimalToHex(chainInfo.chainId),
      };

      try {
        await web3Provider.send('wallet_switchEthereumChain', [
          { chainId: metamaskChainInfo.chainId },
        ]);
      } catch (e) {
        await web3Provider.request({
          method: 'wallet_addEthereumChain',
          params: [metamaskChainInfo],
        });
      }

      wallet = new ethers.providers.Web3Provider(web3Provider);

      await wallet.send('eth_requestAccounts', []);

      // this will ask metamask to connect to the wallet
      // this.signer = wallet.getSigner();

      this.provider = wallet;
    }

    // ----------------------------------------------
    //          (Node) Setting up Provider
    // ----------------------------------------------
    else if (isNode()) {
      this.log("----- We're in node! -----");
      this.provider = new ethers.providers.StaticJsonRpcProvider({
        url: this.rpc,
        skipFetchSetup: true,
      });
    }

    // ======================================
    //     Signer with CUSTOM PRIVATE KEY
    // ======================================
    if (!SETUP_DONE && this.privateKey) {
      this.log('Using your own private key');
      if (!this.privateKey.startsWith('0x')) {
        this.privateKey = '0x' + this.privateKey;
      }
      this.signer = new ethers.Wallet(this.privateKey, this.provider);
      this.provider = this.signer.provider;
      SETUP_DONE = true;
    }

    // ======================================
    //      Signer with CUSTOM Signer
    // ======================================
    if (!SETUP_DONE && this.signer) {
      this.log('Using your own signer');
      this.provider = this.signer.provider;
      SETUP_DONE = true;
    }

    // =====================================
    //       Signer with Storage Key
    // =====================================
    if (!SETUP_DONE && this.options?.storeOrUseStorageKey) {
      this.log('Using your own signer');

      const STORAGE_KEY = 'lit-pkp-tool-registry-private-key';

      this.log("Let's see if you have a private key in your local storage!");

      // -- find private key in local storage
      let storagePrivateKey;

      try {
        storagePrivateKey = localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        // swallow
        // this.log('Not a problem.');
      }

      // -- (NOT FOUND) no private key found
      if (!storagePrivateKey) {
        this.log('Not a problem, we will generate a random private key');
        storagePrivateKey = ethers.utils.hexlify(ethers.utils.randomBytes(32));
      }

      // -- (FOUND) private key found
      else {
        this.log("Found your private key in local storage. Let's use it!");
      }

      this.signer = new ethers.Wallet(storagePrivateKey, this.provider);

      this.log('- Your private key:', storagePrivateKey);
      this.log('- Your address:', await this.signer.getAddress());
      this.log('- this.signer:', this.signer);
      this.log('- this.provider.getSigner():', this.provider.getSigner());

      // -- (OPTION) store private key in local storage
      if (this.options?.storeOrUseStorageKey) {
        this.log(
          "You've set the option to store your private key in local storage."
        );
        localStorage.setItem(STORAGE_KEY, storagePrivateKey);
      }
    }

    // ----------------------------------------
    //       Signer with Metamask login
    // ----------------------------------------
    this.log('Check for browser', isBrowser());
    this.log('Check for SETUP_DONE', SETUP_DONE);

    if (!SETUP_DONE && isBrowser()) {
      this.log('Using Metamask signer');

      const web3Provider = window.ethereum;

      if (!web3Provider) {
        const msg =
          'No web3 provider found. Please install Brave, MetaMask or another web3 provider.';
        alert(msg);
        throw new InitError(
          {
            info: {
              web3Provider,
            },
          },
          msg
        );
      }

      function _decimalToHex(decimal: number): string {
        return '0x' + decimal.toString(16);
      }

      const chainInfo = METAMASK_CHAIN_INFO_BY_NETWORK[this.litNetwork];

      const metamaskChainInfo = {
        ...chainInfo,
        chainId: _decimalToHex(chainInfo.chainId),
      };

      try {
        await web3Provider.send('wallet_switchEthereumChain', [
          { chainId: metamaskChainInfo.chainId },
        ]);
      } catch (e) {
        await web3Provider.request({
          method: 'wallet_addEthereumChain',
          params: [metamaskChainInfo],
        });
      }

      wallet = new ethers.providers.Web3Provider(web3Provider);
      this.log('wallet:', wallet);

      this.signer = wallet.getSigner();
      this.log('this.signer:', this.signer);
    }

    this.log('Your Signer:', this.signer);
    this.log('Your Provider:', this.provider?.connection);

    if (!this.provider) {
      this.log('No provider found. Will try to use the one from the signer.');
      if (!this.signer) {
        throw new Error('No signer available to get provider from');
      }
      this.provider = this.signer.provider;
      this.log('Your Provider(from signer):', this.provider?.connection);
    }

    this.log('Your address:', await this.signer?.getAddress());

    this.toolRegistryContract = {
      read: new ethers.Contract(
        DEFAULT_REGISTRY_CONFIG[this.litNetwork].contractAddress,
        PKP_TOOL_REGISTRY_ABI,
        this.provider
      ),
      write: new ethers.Contract(
        DEFAULT_REGISTRY_CONFIG[this.litNetwork].contractAddress,
        PKP_TOOL_REGISTRY_ABI,
        this.signer
      ),
    };

    this.litContracts = new LitContracts({
      signer: this.signer,
      network: this.litNetwork,
      debug: false,
    });
    await this.litContracts.connect();

    this.connected = true;
  };

  /**
   * Checks if the tool registry contract and lit contracts are initialized.
   * @throws If either the tool registry contract or lit contracts are not initialized.
   */
  private checkInitialized(): asserts this is { litContracts: LitContracts } {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }
    if (!this.litContracts) {
      throw new Error('Lit contracts not initialized');
    }
    this.log('toolRegistryContract', this.toolRegistryContract);
    this.log('litContracts', this.litContracts);
  }

  /**
   * Retrieves the token ID for a PKP based on its Ethereum address.
   * @param pkpEthAddress - The Ethereum address of the PKP.
   * @returns The token ID of the PKP.
   * @throws If the tool registry contract or lit contracts are not initialized.
   */
  public async getTokenIdByPkpEthAddress(pkpEthAddress: string) {
    this.checkInitialized();
    console.log('pkpEthAddress', pkpEthAddress);
    const tokenId = await getTokenIdByPkpEthAddress(
      this.litContracts.pubkeyRouterContract.read,
      pkpEthAddress
    );
    console.log('tokenId', tokenId);
    return tokenId;
  }

  /**
   * Mints a new PKP and saves the metadata to the Admin's (local) storage.
   * @returns A promise that resolves to the minted PKP metadata.
   * @throws If the PKP minting fails.
   */
  public async mintPkp(): Promise<PkpInfo> {
    this.checkInitialized();
    if (!this.signer) {
      throw new Error('Signer not initialized');
    }
    const mintCost = await this.litContracts.pkpNftContract.read.mintCost();
    if (mintCost.gt(await this.signer.getBalance())) {
      throw new AwSignerError(
        AwSignerErrorType.INSUFFICIENT_BALANCE_PKP_MINT,
        `${await this.signer?.getAddress()} has insufficient balance to mint PKP: ${ethers.utils.formatEther(
          await this.signer?.getBalance()
        )} < ${ethers.utils.formatEther(mintCost)}`
      );
    }

    const mintMetadata =
      await this.litContracts.pkpNftContractUtils.write.mint();

    return {
      info: mintMetadata.pkp,
      mintTx: mintMetadata.tx,
      mintReceipt: mintMetadata.res,
    };
  }

  /**
   * Transfers ownership of the PKP to a new owner.
   * @param newOwner - The address of the new owner.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the Admin instance is not properly initialized.
   */
  public async transferPkpOwnership(pkpTokenId: string, newOwner: string, address: string) {
    this.checkInitialized();

    const tx = await this.litContracts.pkpNftContract.write[
      'safeTransferFrom(address,address,uint256)'
    ](address, newOwner, pkpTokenId);

    const receipt = await tx.wait();
    if (receipt.status === 0) {
      throw new AwSignerError(
        AwSignerErrorType.ADMIN_PKP_TRANSFER_FAILED,
        'PKP transfer failed'
      );
    }

    return receipt;
  }

  /**
   * Retrieves the owner of the PKP
   * @param pkpTokenId - The pkpTokenId of the PKP.
   * @returns A promise that resolves to the owner.
   * @throws If the PKP is not found in storage.
   */
  public async getPKPOwner(pkpTokenId: string) {
    this.checkInitialized();
    const pkpOwner = await this.litContracts.pkpNftContract.read.ownerOf(
      pkpTokenId
    );

    return pkpOwner;
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
    this.checkInitialized();

    const {
      signingScopes = [AUTH_METHOD_SCOPE.SignAnything],
      enableTools = true,
    } = options;

    const litContractsTxReceipt = await this.litContracts.addPermittedAction({
      ipfsId: ipfsCid,
      authMethodScopes: signingScopes,
      pkpTokenId: pkpTokenId,
    });

    const toolRegistryContractTx =
      await this.toolRegistryContract.write.registerTools(
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
   * Removes a policy for a specific tool and delegatee.
   * @param pkpTokenId - The PKP token ID.
   * @param ipfsCid - The IPFS CID of the tool.
   * @param delegatee - The address of the delegatee.
   * @returns A promise that resolves to the transaction receipt.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async removeTool(pkpTokenId: string, ipfsCid: string) {
    this.checkInitialized();

    const revokePermittedActionTx =
      await this.litContracts.pkpPermissionsContractUtils.write.revokePermittedAction(
        pkpTokenId,
        ipfsCid
      );
    await revokePermittedActionTx.wait();

    const removeToolsTx = await this.toolRegistryContract.write.removeTools(
      pkpTokenId,
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
    this.checkInitialized();

    const tx = await this.toolRegistryContract.write.enableTools(pkpTokenId, [
      toolIpfsCid,
    ]);

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
    this.checkInitialized();

    const tx = await this.toolRegistryContract.write.disableTools(pkpTokenId, [
      toolIpfsCid,
    ]);

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
    this.checkInitialized();

    const [isRegistered, isEnabled] =
      await this.toolRegistryContract.read.isToolRegistered(
        pkpTokenId,
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
    this.checkInitialized();

    const toolInfos = await this.toolRegistryContract.read.getRegisteredTools(
      pkpTokenId,
      [toolIpfsCid]
    );

    return toolInfos[0];
  }

  /**
   * Get all registered tools for a given PKP.
   * @param pkpTokenId - The token ID of the PKP.
   * @returns A promise that resolves to the tool information.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getAllRegisteredTools(pkpTokenId: string) {
    this.checkInitialized();

    const tools = await this.toolRegistryContract.read.getAllRegisteredTools(
      pkpTokenId
    );

    return tools;
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
    this.checkInitialized();

    const registeredTools = await getRegisteredToolsAndDelegatees(
      this.toolRegistryContract.read,
      this.litContracts,
      pkpTokenId
    );

    return registeredTools;
  }

  /**
   * Retrieves all delegatees for the PKP.
   * @returns An array of delegatee addresses.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getDelegatees(pkpTokenId: string): Promise<string[]> {
    this.checkInitialized();
    return await this.toolRegistryContract.read.getDelegatees(pkpTokenId);
  }

  /**
   * Checks if an address is a delegatee for the PKP.
   * @param delegatee - The address to check.
   * @returns A promise that resolves to a boolean indicating whether the address is a delegatee.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async isDelegatee(pkpTokenId: string, delegatee: string) {
    this.checkInitialized();

    return await this.toolRegistryContract.read.isPkpDelegatee(
      pkpTokenId,
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
    this.checkInitialized();

    const tx = await this.toolRegistryContract.write.addDelegatees(pkpTokenId, [
      delegatee,
    ]);

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
    this.checkInitialized();
    const tx = await this.toolRegistryContract.write.removeDelegatees(
      pkpTokenId,
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
    this.checkInitialized();

    const result =
      await this.toolRegistryContract.read.isToolPermittedForDelegatee(
        pkpTokenId,
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
    this.checkInitialized();

    return this.toolRegistryContract.read.getPermittedToolsForDelegatee(
      pkpTokenId,
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
    this.checkInitialized();
    const tx = await this.toolRegistryContract.write.permitToolsForDelegatees(
      pkpTokenId,
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
    this.checkInitialized();

    const tx = await this.toolRegistryContract.write.unpermitToolsForDelegatees(
      pkpTokenId,
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
    this.checkInitialized();

    const result =
      await this.toolRegistryContract.read.getToolPoliciesForDelegatees(
        pkpTokenId,
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
    this.checkInitialized();

    const tx =
      await this.toolRegistryContract.write.setToolPoliciesForDelegatees(
        pkpTokenId,
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
    this.checkInitialized();

    const tx =
      await this.toolRegistryContract.write.removeToolPoliciesForDelegatees(
        pkpTokenId,
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
    this.checkInitialized();

    const tx =
      await this.toolRegistryContract.write.enableToolPoliciesForDelegatees(
        pkpTokenId,
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
    this.checkInitialized();

    const tx =
      await this.toolRegistryContract.write.disableToolPoliciesForDelegatees(
        pkpTokenId,
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
   * @returns A promise that resolves to an array of policy parameter values.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getToolPolicyParametersForDelegatee(
    pkpTokenId: string,
    ipfsCid: string,
    delegatee: string,
    parameterNames: string[]
  ) {
    this.checkInitialized();

    const parameterValues =
      await this.toolRegistryContract.read.getToolPolicyParameters(
        pkpTokenId,
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
    this.checkInitialized();

    const parameters =
      await this.toolRegistryContract.read.getAllToolPolicyParameters(
        pkpTokenId,
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
    this.checkInitialized();

    const tx =
      await this.toolRegistryContract.write.setToolPolicyParametersForDelegatee(
        pkpTokenId,
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
    this.checkInitialized();

    const tx =
      await this.toolRegistryContract.write.removeToolPolicyParametersForDelegatee(
        pkpTokenId,
        ipfsCid,
        delegatee,
        parameterNames
      );

    return await tx.wait();
  }

  /**
   * Retrieves all delegated PKPs (Programmable Key Pairs) for the Delegatee.
   * @returns A promise that resolves to an array of `DelegatedPkpInfo` objects.
   * @throws If the tool policy registry contract, delegatee wallet, or Lit contracts are not initialized.
   */
  public async getDelegatedPkps(address: string): Promise<DelegatedPkpInfo[]> {
    this.checkInitialized();

    // Get token IDs of delegated PKPs
    const tokenIds = await this.toolRegistryContract.read.getDelegatedPkps(
      address
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
  public async getPermittedToolsForPkp(pkpTokenId: string, address: string) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    if (!address) {
      throw new Error('Signer not initialized');
    }

    return getPermittedToolsForDelegatee(
      this.toolRegistryContract.read,
      pkpTokenId,
      address
    );
  }

  /**
   * Retrieves the policy for a specific tool.
   * @param pkpTokenId - The token ID of the PKP.
   * @param ipfsCid - The IPFS CID of the tool.
   * @returns An object containing the policy and version for the tool.
   * @throws If the tool policy registry contract is not initialized.
   */
  public async getToolPolicy(pkpTokenId: string, ipfsCid: string, address: string) {
    if (!this.toolRegistryContract) {
      throw new Error('Tool policy manager not initialized');
    }

    const results =
      await this.toolRegistryContract.read.getToolPoliciesForDelegatees(
        pkpTokenId,
        [ipfsCid],
        [address]
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
    intentMatcher: IntentMatcher,
    address: string
  ): Promise<IntentMatcherResponse<any>> {
    // Get registered tools
    const { toolsWithPolicies, toolsWithoutPolicies } =
      await this.getPermittedToolsForPkp(pkpTokenId, address);

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
    params: Omit<JsonExecutionSdkParams, 'sessionSigs'>,
    litNodeClient: LitNodeClientNodeJs,
    address: string
  ): Promise<ExecuteJsResponse> {
    this.checkInitialized();

    if (!this.signer) {
      throw new Error('Signer not initialized');
    }

    const capacityCreditInfo = await mintCapacityCredit(this.litContracts);

    let capacityDelegationAuthSig: AuthSig | undefined;
    if (capacityCreditInfo !== null) {
      capacityDelegationAuthSig = (
        await litNodeClient.createCapacityDelegationAuthSig({
          dAppOwnerWallet: this.signer,
          capacityTokenId: capacityCreditInfo.capacityTokenId,
          delegateeAddresses: [address],
          uses: '1',
        })
      ).capacityDelegationAuthSig;
    }

    const sessionSignatures = await litNodeClient.getSessionSigs({
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
        uri = '',
        expiration,
        resourceAbilityRequests,
      }: {
        uri?: string;
        expiration?: string;
        resourceAbilityRequests?: LitResourceAbilityRequest[];
      }) => {
        const toSign = await createSiweMessage({
          uri,
          expiration: expiration?.toString(),
          resources: resourceAbilityRequests,
          walletAddress: address,
          nonce: await litNodeClient.getLatestBlockhash(),
          litNodeClient: litNodeClient,
        });

        if (!this.signer) {
          throw new Error('Signer not initialized');
        }
        return await generateAuthSig({
          signer: this.signer,
          toSign,
        });
      },
    });

    try {
      return litNodeClient.executeJs({
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
}
