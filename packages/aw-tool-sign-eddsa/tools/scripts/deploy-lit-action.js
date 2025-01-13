const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const networks = require('../config/networks');
const dotenvx = require('@dotenvx/dotenvx');

// Load environment variables
dotenvx.config({ path: path.join(__dirname, '../../../../.env') });

async function uploadToIPFS(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath);
    const form = new FormData();
    form.append('file', fileContent, {
      filename: path.basename(filePath),
      contentType: 'application/javascript',
    });

    // Get Pinata JWT from environment variable
    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT) {
      throw new Error('PINATA_JWT environment variable is not set');
    }

    const response = await fetch(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${text}`);
    }

    const data = await response.json();
    return data.IpfsHash;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw error;
  }
}

async function main() {
  try {
    const distDir = path.join(__dirname, '../../dist');

    // Upload each built action to IPFS
    const deployResults = await Promise.all(
      Object.entries(networks).map(async ([network, config]) => {
        const actionPath = path.join(distDir, config.outputFile);
        if (!fs.existsSync(actionPath)) {
          throw new Error(
            `Built action not found at ${actionPath}. Please run build:action first.`
          );
        }

        console.log(`Deploying ${network} Lit Action to IPFS...`);
        const ipfsCid = await uploadToIPFS(actionPath);
        console.log(`Deployed ${network} Lit Action to IPFS: ${ipfsCid}`);
        return { network, ipfsCid };
      })
    );

    // Write deployment results to a JSON file
    const deployConfig = deployResults.reduce(
      (acc, { network, ipfsCid }) => ({
        ...acc,
        [network]: ipfsCid,
      }),
      {}
    );

    fs.writeFileSync(
      path.join(distDir, 'ipfs.json'),
      JSON.stringify(deployConfig, null, 2),
      'utf8'
    );

    console.log('✅ Successfully deployed all Lit Actions');
  } catch (error) {
    console.error('❌ Error in deploy process:', error);
    process.exit(1);
  }
}

main();
