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
 * IPFS CIDs for each network's Lit Action.
 * @type {Record<keyof typeof DEFAULT_CIDS, NetworkCids>}
 */
export const IPFS_CIDS = DEFAULT_CIDS;
