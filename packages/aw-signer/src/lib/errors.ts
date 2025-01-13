/**
 * Enum representing the types of errors that can occur in the AwSigner module.
 * Each error type corresponds to a specific failure scenario.
 */
export enum AwSignerErrorType {
  /** Indicates that the Lit network was not provided for the Admin role. */
  ADMIN_MISSING_LIT_NETWORK = 'ADMIN_MISSING_LIT_NETWORK',

  /** Indicates that the private key was not provided for the Admin role. */
  ADMIN_MISSING_PRIVATE_KEY = 'ADMIN_MISSING_PRIVATE_KEY',

  /** Indicates that the PKP was not found in storage. */
  ADMIN_PKP_NOT_FOUND = 'ADMIN_PKP_NOT_FOUND',

  /** Indicates that the PKP transfer failed. */
  ADMIN_PKP_TRANSFER_FAILED = 'ADMIN_PKP_TRANSFER_FAILED',

  /** Indicates that the Lit network was not provided for the Delegatee role. */
  DELEGATEE_MISSING_LIT_NETWORK = 'DELEGATEE_MISSING_LIT_NETWORK',

  /** Indicates that the private key was not provided for the Delegatee role. */
  DELEGATEE_MISSING_PRIVATE_KEY = 'DELEGATEE_MISSING_PRIVATE_KEY',
  DELEGATEE_MISSING_CREDENTIALS = 'DELEGATEE_MISSING_CREDENTIALS',

  /** Indicates that multisig functionality for the Admin role is not implemented. */
  ADMIN_MULTISIG_NOT_IMPLEMENTED = 'ADMIN_MULTISIG_NOT_IMPLEMENTED',

  /** Indicates insufficient balance for minting a PKP (Programmable Key Pair). */
  INSUFFICIENT_BALANCE_PKP_MINT = 'INSUFFICIENT_BALANCE_PKP_MINT',

  /** Indicates insufficient balance for minting a capacity credit. */
  INSUFFICIENT_BALANCE_CAPACITY_CREDIT_MINT = 'INSUFFICIENT_BALANCE_CAPACITY_CREDIT_MINT',

  /** Indicates a failure to retrieve an item from storage. */
  STORAGE_FAILED_TO_GET_ITEM = 'STORAGE_FAILED_TO_GET_ITEM',

  /** Indicates that the wrapped key was not found in storage. */
  ADMIN_WRAPPED_KEY_NOT_FOUND = 'ADMIN_WRAPPED_KEY_NOT_FOUND',
}

/**
 * Type representing additional details about an error.
 * This can include nested errors, custom properties, or other metadata.
 */
export type ErrorDetails = {
  /** The name of the error. */
  name?: string;

  /** The error message. */
  message?: string;

  /** The stack trace of the error. */
  stack?: string;

  /** The type of the error, if it is an `AwSignerError`. */
  type?: AwSignerErrorType;

  /** Additional details about the error. */
  details?: unknown;

  /** Allows for additional custom properties. */
  [key: string]: unknown;
};

/**
 * Custom error class for the AwSigner module.
 * Extends the built-in `Error` class to include additional metadata such as error type and serialized details.
 */
export class AwSignerError extends Error {
  /**
   * A serialized string representation of the error details.
   * This is useful for logging and debugging.
   */
  public readonly serializedDetails: string;

  /**
   * Creates an instance of `AwSignerError`.
   *
   * @param type - The type of the error, as defined in `AwSignerErrorType`.
   * @param message - A human-readable error message.
   * @param details - Optional additional details about the error, such as nested errors or custom properties.
   */
  constructor(
    public readonly type: AwSignerErrorType,
    message: string,
    public readonly details?: Record<string, ErrorDetails | unknown>
  ) {
    super(message);
    this.name = 'AwSignerError';

    // Serialize the details for better error logging
    this.serializedDetails = details
      ? JSON.stringify(
          details,
          (key, value) => {
            if (value instanceof Error) {
              // Handle nested errors
              return {
                name: value.name,
                message: value.message,
                stack: value.stack,
                ...(value instanceof AwSignerError
                  ? {
                      type: value.type,
                      details: value.serializedDetails
                        ? JSON.parse(value.serializedDetails)
                        : undefined,
                    }
                  : {}),
              };
            }
            return value;
          },
          2
        )
      : '';
  }

  /**
   * Converts the error to a JSON-compatible object.
   * This is useful for serialization and logging.
   *
   * @returns An object containing the error's name, type, message, details, and stack trace.
   */
  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      details: this.serializedDetails
        ? JSON.parse(this.serializedDetails)
        : undefined,
      stack: this.stack,
    };
  }
}
