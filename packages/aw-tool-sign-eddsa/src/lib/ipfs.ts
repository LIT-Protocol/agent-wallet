import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Default development IPFS CIDs (Content Identifiers) for each Lit network.
 * These are placeholders used when the actual deployed CIDs are not available.
 */
const DEFAULT_CIDS = {
  'datil-dev': 'DEV_IPFS_CID',
  'datil-test': 'TEST_IPFS_CID',
  datil: 'PROD_IPFS_CID',
} as const;

/**
 * Attempts to read the deployed IPFS CIDs from the build output file (`ipfs.json`).
 * If the file is not found or cannot be read, falls back to the default development CIDs.
 */
let deployedCids: Record<keyof typeof DEFAULT_CIDS, string> = DEFAULT_CIDS;

try {
  // Path to the `ipfs.json` file in the build output directory
  const ipfsPath = join(__dirname, '../../../dist/ipfs.json');

  // Check if the `ipfs.json` file exists
  if (existsSync(ipfsPath)) {
    // Dynamically import the `ipfs.json` file
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ipfsJson = require(ipfsPath);

    // Use the CIDs from the `ipfs.json` file
    deployedCids = ipfsJson;
  } else {
    // Log a warning if the `ipfs.json` file is not found
    console.warn(
      'ipfs.json not found. Using development CIDs. Please run deploy script to update.'
    );
  }
} catch (error) {
  // Log a warning if there is an error reading the `ipfs.json` file
  console.warn(
    'Failed to read ipfs.json. Using development CIDs:',
    error instanceof Error ? error.message : String(error)
  );
}

/**
 * Exported IPFS CIDs for each Lit network's Lit Action.
 * These are either the deployed CIDs (if available) or the default development CIDs.
 */
export const IPFS_CIDS = deployedCids;
