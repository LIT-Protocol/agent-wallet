import { Admin as AwAdmin, type LitNetwork } from '@lit-protocol/agent-wallet';

import { AdminErrors, LawCliError, logger } from '../../core';

// Define the shape of a wrapped key
export interface WrappedKeyInfo {
  id: string;
  publicKey: string;
  keyType: string;
  memo: string;
  pkpAddress: string;
  litNetwork: string;
}

// Define the shape of the wrapped key methods that exist on AwAdmin
interface WrappedKeyMethods {
  getWrappedKeys(): Promise<WrappedKeyInfo[]>;
  getWrappedKeyById(id: string): Promise<WrappedKeyInfo>;
  removeWrappedKey(id: string): Promise<WrappedKeyInfo>;
  mintWrappedKey(pkpTokenId: string): Promise<WrappedKeyInfo>;
}

export class Admin {
  public awAdmin: AwAdmin;

  /**
   * Private constructor for the Admin class.
   * @param awAdmin - An instance of the `AwAdmin` class.
   */
  private constructor(awAdmin: AwAdmin) {
    this.awAdmin = awAdmin;
  }

  /**
   * Gets all wrapped keys from storage.
   * @returns A promise that resolves to an array of wrapped keys.
   */
  public async getWrappedKeys(): Promise<WrappedKeyInfo[]> {
    return (this.awAdmin as unknown as WrappedKeyMethods).getWrappedKeys();
  }

  /**
   * Gets a wrapped key by its ID.
   * @param id - The ID of the wrapped key.
   * @returns A promise that resolves to the wrapped key.
   * @throws If the wrapped key is not found.
   */
  public async getWrappedKeyById(id: string): Promise<WrappedKeyInfo> {
    return (this.awAdmin as unknown as WrappedKeyMethods).getWrappedKeyById(id);
  }

  /**
   * Removes a wrapped key from storage.
   * @param id - The ID of the wrapped key to remove.
   * @returns A promise that resolves to the removed wrapped key.
   * @throws If the wrapped key is not found.
   */
  public async removeWrappedKey(id: string): Promise<WrappedKeyInfo> {
    return (this.awAdmin as unknown as WrappedKeyMethods).removeWrappedKey(id);
  }

  /**
   * Mints a new wrapped key for a PKP.
   * @param pkpTokenId - The token ID of the PKP.
   * @returns A promise that resolves to the minted wrapped key.
   */
  public async mintWrappedKey(pkpTokenId: string): Promise<WrappedKeyInfo> {
    return (this.awAdmin as unknown as WrappedKeyMethods).mintWrappedKey(pkpTokenId);
  }

  /**
   * Creates an instance of the `AwAdmin` class.
   * Handles errors related to missing private keys or insufficient balances by prompting the user for input.
   *
   * @param litNetwork - The Lit network to use for the Admin role.
   * @param privateKey - Optional. The private key for the Admin role.
   * @returns A promise that resolves to an instance of the `AwAdmin` class.
   * @throws If initialization fails, the function logs an error and exits the process.
   */
  private static async createAwAdmin(
    litNetwork: LitNetwork,
    privateKey: string
  ): Promise<AwAdmin> {
    let awAdmin: AwAdmin;
    try {
      // Attempt to create the AwAdmin instance.
      awAdmin = await AwAdmin.create(
        {
          type: 'eoa',
          privateKey,
        },
        {
          litNetwork,
        }
      );
    } catch (error) {
      // TODO: This shouldn't happen as handleUseEoa should ensure a private key is provided
      // // Handle specific errors related to missing private keys or insufficient balances.
      // if (error instanceof AwSignerError) {
      //   if (error.type === AwSignerErrorType.ADMIN_MISSING_PRIVATE_KEY) {
      //     // Prompt the user for a private key if it is missing.
      //     const privateKey = await promptAdminInit();
      //     return Admin.createAwAdmin(litNetwork, privateKey);
      //   }
      // }

      if (error instanceof Error && error.message) {
        throw new LawCliError(
          AdminErrors.FAILED_TO_INITIALIZE_ADMIN,
          `Failed to initialize Admin role: ${error.message}`
        );
      }

      // TODO Maybe this isn't the best way to handle this
      logger.error('An unknown error occurred while initializing Admin role.');
      throw error;
    }

    return awAdmin;
  }

  /**
   * Creates an instance of the `Admin` class.
   * @param litNetwork - The Lit network to use for the Admin role.
   * @returns A promise that resolves to an instance of the `Admin` class.
   */
  public static async create(litNetwork: LitNetwork, adminPrivateKey: string) {
    const awAdmin = await Admin.createAwAdmin(litNetwork, adminPrivateKey);
    return new Admin(awAdmin);
  }
}
