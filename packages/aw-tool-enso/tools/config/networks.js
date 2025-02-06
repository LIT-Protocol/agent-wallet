/**
 * Network configurations for building and deploying Lit Actions
 */
module.exports = {
  'datil-dev': {
    pkpToolRegistryAddress: '0x2707eabb60D262024F8738455811a338B0ECd3EC',
    litNetwork: 'datil-dev',
    outputFiles: [
      'deployed-lit-action-datil-dev.js',
      'deployed-lit-action-policy-datil-dev.js',
    ],
  },
  'datil-test': {
    pkpToolRegistryAddress: '0x525bF2bEb622D7C05E979a8b3fFcDBBEF944450E',
    litNetwork: 'datil-test',
    outputFiles: [
      'deployed-lit-action-datil-test.js',
      'deployed-lit-action-policy-datil-test.js',
    ],
  },
  datil: {
    pkpToolRegistryAddress: '0xBDEd44A02b64416C831A0D82a630488A854ab4b1',
    litNetwork: 'datil',
    outputFiles: [
      'deployed-lit-action-datil.js',
      'deployed-lit-action-policy-datil.js',
    ],
  },
};
