const esbuild = require('esbuild');
const path = require('path');
const networks = require('../config/networks');

async function buildFile(entryPoint, outfile, network, config) {
  try {
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      minify: false,
      format: 'iife',
      globalName: 'LitAction',
      outfile,
      define: {
        'process.env.NETWORK': `"${network}"`,
        LIT_NETWORK: `"${network}"`,
        PKP_TOOL_REGISTRY_ADDRESS: `"${config.pkpToolRegistryAddress}"`,
      },
      target: ['es2020'],
    });
    console.log(
      `Successfully built ${path.basename(entryPoint)} for network: ${network}`
    );
  } catch (error) {
    console.error(`Error building ${path.basename(entryPoint)}:`, error);
    process.exit(1);
  }
}

async function buildAction(network) {
  const config = networks[network];
  const mainEntryPoint = path.resolve(
    __dirname,
    '../../src/lib/lit-actions/tool.ts'
  );
  const policyEntryPoint = path.resolve(
    __dirname,
    '../../src/lib/lit-actions/policy.ts'
  );

  const mainOutfile = path.resolve(
    __dirname,
    '../../dist',
    `deployed-lit-action-${network}.js`
  );
  const policyOutfile = path.resolve(
    __dirname,
    '../../dist',
    `deployed-lit-action-policy-${network}.js`
  );

  await Promise.all([
    buildFile(mainEntryPoint, mainOutfile, network, config),
    buildFile(policyEntryPoint, policyOutfile, network, config),
  ]);
}

// Build for each network
Promise.all([
  buildAction('datil-dev'),
  buildAction('datil-test'),
  buildAction('datil'),
]).catch(() => process.exit(1));
