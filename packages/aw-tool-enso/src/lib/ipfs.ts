import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Default development CIDs for different environments.
 * @type {Object.<string, NetworkCids>}
 * @property {NetworkCids} datil-dev - CIDs for the development environment.
 * @property {NetworkCids} datil-test - CIDs for the test environment.
 * @property {NetworkCids} datil - CIDs for the production environment.
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
 * Tries to read the IPFS CIDs from the build output.
 * Falls back to default development CIDs if the file is not found or cannot be read.
 * @type {Record<keyof typeof DEFAULT_CIDS, NetworkCids>}
 */
let deployedCids = DEFAULT_CIDS;

const ipfsPath = join(__dirname, '../../../dist/ipfs.json');
if (existsSync(ipfsPath)) {
  // We know this import will work because we checked the file exists
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ipfsJson = require(ipfsPath);
  deployedCids = ipfsJson;
} else {
  throw new Error(
    'Failed to read ipfs.json. You should only see this error if you are running the monorepo locally. You should run pnpm deploy:tools to update the ipfs.json files.'
  );
}

/**
 * IPFS CIDs for each network's Lit Action.
 * @type {Record<keyof typeof DEFAULT_CIDS, NetworkCids>}
 */
export const IPFS_CIDS = deployedCids;
