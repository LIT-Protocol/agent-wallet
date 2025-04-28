# Deprecation Notice

**This Lit Agent Wallet project has been deprecated in favor of our new architecture: [Vincent](https://github.com/LIT-Protocol/Vincent).**

To learn more, check out the [Vincent documentation](https://docs.heyvincent.ai/) and explore our [Vincent App demo](https://demo.heyvincent.ai/), which showcases how users can delegate usage of their Agent Wallet to a Vincent App to perform transactions on their behalf—without exposing their private key.

If you’d like to discuss how to empower your users with delegated access while maintaining private key security, feel free to reach out to us on [Telegram](https://t.me/+aa73FAF9Vp82ZjJh).

# Lit Agent Wallet

Welcome to the **L**it **A**gent **W**allet (LAW) project! This repository provides a secure and trustless solution for managing AI Agent wallets using the Lit SDK. The framework ensures that Agent owners retain full control over their funds, preventing tampering by Agent developers.

In addition to the documentation here, please visit [here](https://developer.litprotocol.com/agent-wallet/intro) for a more detail guide on what LAW is, and how you can get started with it!

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Key Definitions](#key-definitions)
- [Architecture](#architecture)
- [Creating a New Tool](#creating-a-new-tool-package)
- [Getting Started](#getting-started)
  - [CLI Demo](#cli-users)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Addtional Support](#additional-support)

## Introduction

The Lit Protocol team has addressed a critical challenge in the AI Agent space: **"How do we trust an agent developer with an Agent's wallet?"** An innovative solution leveraging the Lit SDK has been developed to ensure the security and integrity of AI Agent wallets.

Lit's Agent Wallet provides AI Agents with the ability to be immune to tampering by the Agent developer. This means that the Agent owner (which could be a Decentralized Autonomous Organization (DAO), a Safe Multisig, an Externally Owned Account (EOA), or any other type of account) can maintain full control over their Agent's funds, preventing them from being stolen by the developer responsible for executing the Agent's intents/actions.

## Video Demo

[![Lit Agent Wallet](https://img.youtube.com/vi/Bn7Ru90MAQU/0.jpg)](https://www.youtube.com/watch?v=Bn7Ru90MAQU)

## Features

- **Tamper-Proof Wallets:** Ensures that Agent developers cannot tamper with the Agent's funds.
- **Programmable Key Pairs (PKPs):** Utilizes ECDSA keypairs represented by ERC-721 NFTs.
- **Immutable Actions:** Executes AI Agent intents through immutable JavaScript code published to IPFS.
- **Policy Enforcement:** Allows Admins to define and enforce strict policies on Agent operations.
- **Secure Delegation:** Enables Admins to delegate execution rights while maintaining control over the Agent's assets.

## Key Definitions

Before diving deeper, the following key concepts from the Lit SDK are defined:

- **Programmable Key Pairs (PKPs):** Decentralized key pairs whose private keys can never be exposed, represented by ERC-721 NFTs.
- **Lit Actions:** Immutable JavaScript code snippets published to IPFS, used to execute Agent intents.
- **Subagent:** A GPT-4o model that parses the AI intent to select the correct Lit Action based tool for the PKP to execute.

## Architecture

The framework effectively separates the interests of the Agent owner and the developer through distinct roles:

### Roles

- **Admin (Agent Owner):**
  - Holds ownership of the PKP NFT.
  - Defines the tools available for the Agent to execute.
  - Sets policies to restrict and control the usage of these tools.
  - Can be any type of account (e.g., DAO, Safe Multisig, EOA, or other account types).
  
  *Example Policies:*
  - Restricting token transfers to specific addresses.
  - Limiting the amount and type of ERC-20 tokens transferable.
  - Capping daily transfer amounts (e.g., $5,000 worth of ERC-20 tokens per day).

- **Delegatee (Developer):**
  - Party chosen by the admin to execute Agent intents/actions.
  - Operates within the confines of tools and policies defined by the Admin.
  - Must be explicitly authorized by the Admin to perform actions on behalf of the Agent.
  - Limited by the tools and policies defined by the admin.

### Security Mechanisms

- **Distributed Key Generation (DKG):**
  - Ensures that the Agent's private key is never fully reconstructed by any single party.
  - Prevents the Admin, delegatee, or Lit from recreating the private key, enhancing security.


### Package Dependencies

The project is structured into several interconnected packages, each with specific responsibilities. The core TypeScript/JavaScript packages and their dependencies are shown below:

![Dependency graph (1)](https://github.com/user-attachments/assets/904ffeb6-aafa-4b7d-ba31-2414fab8f273)


Additionally, the project includes:

- **@lit-protocol/aw-contracts**: A Foundry project containing the smart contract implementations. While not part of the Node.js package dependency tree, these contracts are fundamental to the system as they are deployed on-chain and interacted with by the TypeScript/JavaScript packages.

Key packages and their purposes:

- **aw-tool**: Base package defining core interfaces, types, and utilities for implementing tools/actions
- **aw-tool-registry**: Central registry for managing and accessing all available tools/actions
- **aw-signer**: Core package handling signing operations, PKP interactions, and policy enforcement
- **agent-wallet**: Main package implementing the agent wallet functionality and integrating all components
- **law-cli**: Command-line interface for interacting with the agent wallet system
- **aw-subagent-openai**: OpenAI integration for intelligent agent functionality and intent parsing
- **aw-contracts**: Smart contract implementations and interfaces for the Agent Wallet system
- **aw-tool-erc20-transfer**: Specialized tool for handling ERC20 token transfers
- **aw-tool-uniswap-swap**: Tool implementation for executing Uniswap swaps
- **aw-tool-sign-ecdsa**: Tool for ECDSA signing operations

## Package Architecture

The Agent Wallet is composed of several packages, each with a specific purpose and responsibility:

### Core Packages

#### @lit-protocol/aw-tool
- **Purpose**: Base package defining core interfaces and types for all tools
- **Key Features**:
  - Defines `AwTool` interface and network configurations
  - Implements network-specific configurations
  - Provides foundational types for all tools

#### @lit-protocol/aw-tool-registry
- **Purpose**: Central registry for managing and accessing tools
- **Key Features**:
  - Tool registration and lookup functionality
  - Network-specific tool management
  - IPFS CID-based tool resolution
- **Key Functions**:
  - `registerTool`: Register new tools
  - `getToolByName`: Lookup tools by name
  - `getToolByIpfsCid`: Find tools by IPFS CID
  - `listToolsByNetwork`: List tools per network

### Tool Implementation Packages

#### Tool Packages (erc20-transfer, uniswap-swap, sign-ecdsa)
- **Purpose**: Implement specific blockchain operations
- **Common Structure**:
  - Tool implementation
  - IPFS-deployed Lit Actions
  - Policy definitions
- **Examples**:
  - `aw-tool-uniswap-swap`: Uniswap V3 swap functionality
    - Default policy IPFS CID: `Qmc6RAbV3WAqfNLvkAxp4hYjd4TDim4PwjWyhGbM9X7nbR`
  - `aw-tool-erc20-transfer`: ERC20 token transfers
    - Default policy IPFS CID: `QmVHC5cTWE1nzBSzEASULdwfHo1QiYMEr5Ht83anxe6uWB`
  - `aw-tool-sign-ecdsa`: ECDSA signing operations
    - Default policy IPFS CID: `QmPaViiSPUVViC2VkTn3PiRWpkqxnh44BxNY8TcHsuTpJi`

#### Creating a New Tool Package
To create a new Agent Wallet tool package, use the provided script:

```bash
pnpm new-tool <tool-name>
```

For example:
```bash
pnpm new-tool my-feature
```

This will:
1. Generate a new tool package in `packages/aw-tool-my-feature`
2. Set up all necessary configuration files
3. Create template files for your tool's logic

After creation, you'll need to:
1. Implement your tool's logic in:
   - `src/lib/lit-actions/tool.ts` (Lit Action code)
   - `src/lib/lit-actions/policy.ts` (Lit Action policy validation)
   - `src/lib/policy.ts` (Tool policy configuration)
   - `src/lib/tool.ts` (Tool functionality)

2. Register your tool in `aw-tool-registry`:
   - Import your tool in `registry.ts`
   - Add your package as a dependency

### Security and Management

#### @lit-protocol/aw-signer
- **Purpose**: PKP management and signing operations
- **Key Features**:
  - PKP minting and management
  - Policy enforcement
  - Delegatee management
  - Tool execution
- **Components**:
  - Admin role implementation
  - Delegatee role implementation
  - Tool policy registry interaction

### AI Integration

#### @lit-protocol/aw-subagent-openai
- **Purpose**: OpenAI integration for intent parsing
- **Key Features**:
  - Natural language intent parsing
  - Tool selection based on intent
  - Parameter validation against schemas
- **Integration**: Works with tool registry for available tools

### Integration and Interface

#### @lit-protocol/agent-wallet
- **Purpose**: Main integration package
- **Features**:
  - Unified interface for wallet operations
  - Re-exports core functionality
  - Type definitions
- **Exports**: Core functionality from aw-signer and aw-subagent-openai

#### @lit-protocol/law-cli
- **Purpose**: Command-line interface
- **Features**:
  - Role-based commands (Admin/Delegatee)
  - Tool management interface
  - Interactive parameter collection
  - Policy management
- **Components**:
  - Command implementations
  - User interaction prompts

## Getting Started

### CLI Users

You can install the Agent Wallet CLI [from NPM](https://www.npmjs.com/package/@lit-protocol/law-cli) using:

```bash
pnpm add -g @lit-protocol/law-cli
```

or

```bash
npm install -g @lit-protocol/law-cli
```

or 

```bash
yarn global add @lit-protocol/law-cli
```

### For Developers

If you're wanting to develop an Agent Wallet tool, extend the functionality of the CLI, or contribute to the project, you'll need to follow the steps below.

#### Prerequisites

To get started with the Lit Protocol Agent Wallet, ensure the following prerequisites are met:

- **Node.js and Package Managers:**
  - Node.js (v18.12 or greater)
  - Git
  - pnpm (install via `npm install -g pnpm`)
  - Yarn or npm (alternative package managers)

- **Blockchain Requirements:**
  - An Ethereum wallet with a private key for the Admin role
  - A separate Ethereum wallet with a private key for the Delegatee role
  - Lit's tstLPX tokens from the [faucet](https://chronicle-yellowstone-faucet.getlit.dev/) for gas fees on Chronicle Yellowstone

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/LIT-Protocol/agent-wallet.git
   ```

   ```bash
   cd agent-wallet
   ```

2. **Install Dependencies and Build:**

   ```bash
   pnpm i
   ```

   ```bash
   pnpm build
   ```

3. **Add a Pinata JWT Token:**

   ```bash
   cp .env.example .env
   ```

   Then add your Pinata JWT token to the `.env` file.

4. **Deploy Tools and Start the CLI:**

   ```bash
   pnpm start:cli
   ```

   This command will:
   - Build all packages
   - Deploy the Lit Actions to IPFS for each tool:
     - Uniswap Swap tool
     - ECDSA Signing tool
     - ERC20 Transfer tool
   - Start the interactive CLI

   **Note:** After running this command the first time and deploying the tools, you can run `pnpm start:cli:no-build` to skip the build step.

4. **Initial Setup Process:**
   
   The setup process involves two main roles: Admin and Delegatee. You'll need to set up the Admin first, then add a Delegatee.

   a. **First CLI Session (Admin Setup):**
      1. Select a Lit Network (e.g., Datil Dev)
      2. Choose the "Admin" role
      3. Enter your Admin private key when prompted
      4. Select "Add Delegatee" from the menu
      5. Enter the Ethereum address of your Delegatee
      6. Use the menu to permit tools and set policies as needed
      7. Exit the CLI once Delegatee setup is complete

   b. **Second CLI Session (Delegatee Setup):**
      1. Start the CLI again with `pnpm start:cli`
      2. Select the same Lit Network as before
      3. Choose the "Delegatee" role
      4. Enter the private key of the Delegatee address you added in the Admin session
      5. You can now execute tools within the policies set by the Admin
      
      Note: Before a Delegatee can use any tools, the Admin must first permit them using the "Permit Tool" option in the Admin menu.

   c. **As an Admin:**
      - Permit tools for use:
        1. Select "Permit Tool" from the menu
        2. Choose the tool to permit (e.g., erc20-transfer, uniswap-swap)
        3. The tool will now be available for Delegatees to use
      - Set up policies:
        1. Select "Set Tool Policy" to configure usage limits
        2. Policies can restrict token amounts, addresses, and other parameters
      - Manage delegatees:
        1. Add or remove delegatees
        2. Monitor delegatee activities
        3. Adjust tool permissions as needed

   d. **As a Delegatee:**
      - Select from available PKPs
      - Choose from tools permitted by the Admin
      - Execute actions within the policy constraints set by the Admin

   For example, to execute a Uniswap swap, you'll need to provide:
   - Token input address
   - Token output address
   - Amount to swap
   - Chain ID
   - RPC URL

The CLI will guide you through each step and provide feedback on the execution status of your commands.

## Additional Support

Need help? Here are some resources to get you started:

- **Documentation**: Visit the [Lit Protocol Documentation](https://developer.litprotocol.com/) for comprehensive guides and API references
- **Telegram**: Connect with us on [Telegram](https://t.me/+aa73FAF9Vp82ZjJh) for updates and community chat

For bug reports and feature requests, please use the GitHub Issues section of this repository or notify us on Telegram.
