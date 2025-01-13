const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const networks = require('../config/networks');

async function buildAction(network, config) {
  console.log(`Building Lit Action for network: ${network}`);

  try {
    // Build the action file
    const result = await esbuild.build({
      entryPoints: [path.join(__dirname, '../../src/lib/lit-action.ts')],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'esnext',
      platform: 'neutral',
      minify: false,
      define: {
        'process.env.NODE_ENV': '"production"',
        PUBKEY_ROUTER_ADDRESS: `"${config.pubkeyRouterAddress}"`,
        PKP_TOOL_REGISTRY_ADDRESS: `"${config.pkpToolRegistryAddress}"`,
        LIT_NETWORK: `"${config.litNetwork}"`,
      },
    });

    const actionCode = result.outputFiles[0].text;

    // Extract the function body
    const startMatch = actionCode.indexOf('var lit_action_default = ');
    const endMatch = actionCode.indexOf('export {');

    if (startMatch === -1 || endMatch === -1) {
      console.error('Compiled code:', actionCode);
      throw new Error('Could not find function boundaries in compiled code');
    }

    // Extract the function definition (excluding the variable assignment)
    const functionBody = actionCode
      .slice(startMatch + 'var lit_action_default = '.length, endMatch)
      .trim()
      .replace(/;$/, ''); // Remove trailing semicolon if present

    // Create self-executing function
    const finalCode = `(${functionBody})();`;

    // Write to output file
    const outputPath = path.join(__dirname, '../../dist', config.outputFile);
    fs.writeFileSync(outputPath, finalCode, 'utf8');

    console.log(`Successfully built ${config.outputFile}`);
    return config.outputFile; // Return just the filename instead of full path
  } catch (error) {
    console.error(`Error building lit-action for ${network}:`, error);
    throw error;
  }
}

async function main() {
  try {
    // Ensure dist directory exists
    const distDir = path.join(__dirname, '../../dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Build for each network
    await Promise.all(
      Object.entries(networks).map(async ([network, config]) => {
        await buildAction(network, config);
      })
    );

    console.log('Successfully built all Lit Actions');
  } catch (error) {
    console.error('Error in build process:', error);
    process.exit(1);
  }
}

main();
