/**
 * Network configurations for building and deploying Lit Actions
 */
module.exports = {
  'datil-dev': {
    pkpToolRegistryAddress: '0xdE8807799579eef5b9A84A0b4164D28E804da571',
    litNetwork: 'datil-dev',
    outputFile: 'deployed-lit-action-datil-dev.js',
  },
  'datil-test': {
    pkpToolRegistryAddress: '0x0b099F7e2520aCC52A361D1cB83fa43660C9a038',
    litNetwork: 'datil-test',
    outputFile: 'deployed-lit-action-datil-test.js',
  },
  datil: {
    pkpToolRegistryAddress: '0xDeb70dCBC7432fEFEdaE900AFF11Dcc5169CfcBB',
    litNetwork: 'datil',
    outputFile: 'deployed-lit-action-datil.js',
  },
};
