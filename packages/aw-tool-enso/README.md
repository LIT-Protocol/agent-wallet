# AW-Tool Enso Documentation

The `aw-tool-enso` package provides utilities for performing onchain actions, such as swap, deposit, lend, borrow, etc. across 180+ protocols.

---

## Files Overview (in src/lib)

### 1. **`ipfs.ts`**

Handles IPFS CIDs for different environments (development, testing, production). Falls back to default CIDs if the build output is not found.

#### Key Features

- **Default CIDs**: Predefined CIDs for `datil-dev`, `datil-test`, and `datil` environments
- **Dynamic CID Loading**: Attempts to load CIDs from `dist/ipfs.json` at runtime
- **Fallback Mechanism**: Uses default CIDs if the file is missing or unreadable

---

### 2. **`lit-action.ts`**

Contains the main logic for executing a Lit Action to perform an Enso route.

#### Key Features

- **PKP Info Retrieval**: Fetches PKP details (token ID, Ethereum address, public key) from the PubkeyRouter contract.
- **Input Validation**: Validates inputs against the policy defined in the PKP Tool Registry.
- **Find the best route between 2 tokens**: Returns the best possible route between two tokens on specified chain.
- **Gas Estimation**: Estimates gas limits and fees for the transaction.
- **Transaction Creation**: Creates and signs the transaction using the PKP public key.
- **Broadcasting**: Sends the signed transaction to the network.

---

### 3. **`policy.ts`**

Defines and validates the Enso policy schema using Zod.

#### Key Features

- **Policy Schema**: Validates policy fields:
  - `type`: Must be 'SignEcdsa'
  - `version`: Policy version string
  - `allowedPrefixes`: Array of allowed message prefixes
- **Encoding/Decoding**: Converts policies to and from ABI-encoded strings using ethers
- **Type Safety**: Uses Zod for schema validation and TypeScript type inference

---

### 4. **`tool.ts`**

Configures the Enso route for different Lit networks.

#### Key Features

- **Parameter Schema**: Validates required parameters:
  - `tokenIn`
  - `tokenOut`
  - `amountIn`
  - `chainId`
- **Network Configuration**: Creates network-specific tools for each supported Lit network
- **Policy Integartion**: Integrates with the `EnsoRoutePolicy`
