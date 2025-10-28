const { resolveSteamRoot } = require('../steam/config-reader');
const { parseDepotKeys } = require('../steam/config-reader');
const path = require('path');

async function simpleTest() {
  console.log('Platform:', process.platform);
  console.log('Testing Steam root resolution...\n');
  
  const result = await resolveSteamRoot();
  
  console.log('Success:', result.success);
  console.log('Steam root:', result.steamRoot);
  
  if (result.errors.length > 0) {
    console.log('\nErrors/Warnings:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  if (result.success && result.steamRoot) {
    console.log('\nTesting depot key extraction...');
    const configVdfPath = path.join(result.steamRoot, 'config', 'config.vdf');
    const keysResult = await parseDepotKeys(configVdfPath);
    
    console.log('Depot keys found:', Object.keys(keysResult.depotKeys).length);
    
    if (Object.keys(keysResult.depotKeys).length > 0) {
      console.log('\nSample depot keys:');
      Object.entries(keysResult.depotKeys).slice(0, 5).forEach(([depotId, key]) => {
        console.log(`  Depot ${depotId}: ${key.substring(0, 16)}...`);
      });
    }
    
    if (keysResult.errors.length > 0) {
      console.log('\nKey extraction errors:');
      keysResult.errors.forEach(err => console.log(`  - ${err}`));
    }
  }
}

simpleTest().catch(console.error);
