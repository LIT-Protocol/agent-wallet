import { existsSync } from 'fs';
import { join } from 'path';

// Type definitions
type NetworkCids = {
  tool: string;
  defaultPolicy: string;
};

/**
 * Default development CIDs for different environments.
 * @type {Object.<string, NetworkCids>}
 */
const DEFAULT_CIDS = {
  'datil-dev': {
    tool: 'DEV_TOOL_IPFS_CID',
    defaultPolicy: 'DEV_POLICY_IPFS_CID',
  },
  'datil-test': {
    tool: 'TEST_TOOL_IPFS_CID',
    defaultPolicy: 'TEST_POLICY_IPFS_CID',
  },
  datil: {
    tool: 'PROD_TOOL_IPFS_CID',
    defaultPolicy: 'PROD_POLICY_IPFS_CID',
  },
} as const;

/**
 * IPFS CIDs for each network's Lit Action.
 * @type {Record<keyof typeof DEFAULT_CIDS, NetworkCids>}
 */
export const IPFS_CIDS: Record<keyof typeof DEFAULT_CIDS, NetworkCids> = 
  // Check if we're in a Node.js environment
  typeof process !== 'undefined' && 
  process.versions && 
  process.versions.node ? 
    (() => {
      let deployedCids = DEFAULT_CIDS;
      const ipfsPath = join(__dirname, '../../../dist/ipfs.json');
      
      if (existsSync(ipfsPath)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ipfsJson = require(ipfsPath);
        deployedCids = ipfsJson;
      } else {
        throw new Error(
          'Failed to read ipfs.json. You should only see this error if you are running the monorepo locally. You should run pnpm deploy:tools to update the ipfs.json files.'
        );
      }
      
      return deployedCids;
    })() 
    : // Browser environment
    DEFAULT_CIDS as Record<keyof typeof DEFAULT_CIDS, NetworkCids>;