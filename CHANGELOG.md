## 0.1.0-19 (2025-02-05)

This was a version bump only, there were no code changes.

## 0.1.0-18 (2025-02-05)

This was a version bump only, there were no code changes.

## 0.1.0-17 (2025-01-31)

This was a version bump only, there were no code changes.

## 0.1.0-16 (2025-01-24)

This was a version bump only, there were no code changes.

## 1.0.0-0 (2025-01-24)

This was a version bump only, there were no code changes.

## 0.1.0-13 (2025-01-24)

This was a version bump only, there were no code changes.

## 0.1.0-11 (2025-01-24)

This was a version bump only, there were no code changes.

## 0.1.0-10 (2025-01-24)

This was a version bump only, there were no code changes.

## 0.1.0-9 (2025-01-12)

### `@lit-protocol/law-cli`

#### Added

- (#26) Admin CLI menus:
  - After selecting the `Admin` role, you are now prompted to select to either manage an existing Agent Wallet or mint a new one.
    - A new `Mint New Agent Wallet` option was added to allow minting new Agent Wallets for a single Admin.
  - After selecting the `Manage` option, you are now prompted to select an Agent Wallet you'd like to manage.
  - After selecting an Agent Wallet, you are now prompted to select a category (`Tools`, `Policies`, `Delegatees`, or `Transfer Ownership`) of what you'd like to manage for the selected Agent Wallet.
    - A new `Transfer Ownership` option was added to allow transferring ownership of an Agent Wallet to a new owner.

### `@lit-protocol/aw-signer`

#### Changed

- (#26) A PKP is no longer automatically minted when an `Admin` is initialized.
- (#26) All `public` methods in `Admin` now expect `pkpTokenId: string` as an argument in order to fetch the PKP from local storage.

#### Added

- (#27) Added Package README:
  - Added a README to the package to provide a high-level overview of the package and its purpose.
  - Added swimlane diagram to the README.
  - Added a CHANGELOG to the package to track changes to the package.
- (#26) Added new methods to the `Admin` class:
  - `getPkps`: Returns an array of `PkpInfo` objects from local storage.
  - `getPkpByTokenId`: Returns a `PkpInfo` object from local storage by its token ID.
  - `mintPkp`: Mints a new PKP, adds it's `PkpInfo` object to local storage, and returns the `PkpInfo` object.
  - `transferPkpOwnership`: Transfers ownership of a PKP to a new owner, removes the `PkpInfo` object from local storage, and returns the transaction receipt.

### `@lit-protocol/aw-tool`

#### Added

- (#27) Added Package README:
    - Added a README to the package to provide a high-level overview of the package and its purpose.
    - Added a CHANGELOG to the package to track changes to the package.

### `@lit-protocol/aw-tool-registry`

#### Added

- (#27) Added Package README:
    - Added a README to the package to provide a high-level overview of the package and its purpose.
    - Added a CHANGELOG to the package to track changes to the package.

## 0.1.0-8 (2025-01-10)

This was a version bump only, there were no code changes.

## 0.1.0-7 (2025-01-09)

This was a version bump only, there were no code changes.

## 0.1.0-6 (2025-01-09)

This was a version bump only, there were no code changes.

## 0.1.0-5 (2025-01-09)

This was a version bump only, there were no code changes.

## 0.1.0-4 (2025-01-09)

This was a version bump only, there were no code changes.

## 0.1.0-3 (2025-01-09)

This was a version bump only, there were no code changes.

## 0.1.0-2 (2025-01-09)

This was a version bump only, there were no code changes.

## 0.1.0-1 (2025-01-09)

This was a version bump only, there were no code changes.

## 0.1.1-10 (2024-12-25)

This was a version bump only, there were no code changes.

## 0.1.1-9 (2024-12-25)

This was a version bump only, there were no code changes.

## 0.1.1-8 (2024-12-25)

This was a version bump only, there were no code changes.

## 0.1.1-7 (2024-12-25)

This was a version bump only, there were no code changes.

## 0.1.1-6 (2024-12-25)

This was a version bump only, there were no code changes.

## 0.1.1-5 (2024-12-25)

This was a version bump only, there were no code changes.

## 0.1.1-4 (2024-12-25)

This was a version bump only, there were no code changes.

## 0.1.1-3 (2024-12-25)

This was a version bump only, there were no code changes.

## 0.1.1-2 (2024-12-25)

This was a version bump only, there were no code changes.

## 0.1.1-1 (2024-12-25)

This was a version bump only, there were no code changes.