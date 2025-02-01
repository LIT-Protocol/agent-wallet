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

let deployedCids = DEFAULT_CIDS;

<<<<<<< HEAD
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
=======
function isNode(): boolean {
  return typeof process !== 'undefined' && 
         process.versions != null && 
         process.versions.node != null;
}

if (isNode()) {
  try {
    const path = require('path');
    const fs = require('fs');
    const url = require('url');
    
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const ipfsPath = path.join(__dirname, '../../../dist/ipfs.json');
    
    if (fs.existsSync(ipfsPath)) {
      deployedCids = require(ipfsPath);
    }
  } catch (error) {
    console.warn('Failed to load IPFS config, using defaults');
  }
>>>>>>> 94e2e1a (fix: browser env errors)
}

export const IPFS_CIDS = deployedCids;
