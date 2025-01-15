const esbuild = require('esbuild');
const path = require('path');
const networks = require('../config/networks');

async function buildAction(network) {
  const entryPoint = path.resolve(__dirname, '../../src/lib/lit-action.ts');
  const outfile = path.resolve(__dirname, '../../dist', `deployed-lit-action-${network}.js`);
  const config = networks[network];

  try {
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: 'LitAction',
      outfile,
      define: {
        'process.env.NETWORK': `"${network}"`,
        'LIT_NETWORK': `"${network}"`,
        'PKP_TOOL_REGISTRY_ADDRESS': `"${config.pkpToolRegistryAddress}"`,
      },
      target: ['es2020'],
    });
    console.log(`Successfully built Lit Action for network: ${network}`);
  } catch (error) {
    console.error('Error building Lit Action:', error);
    process.exit(1);
  }
}

// Build for each network
Promise.all([
  buildAction('datil-dev'),
  buildAction('datil-test'),
  buildAction('datil'),
]).catch(() => process.exit(1));
