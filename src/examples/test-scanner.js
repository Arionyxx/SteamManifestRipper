const { scanDepotCache } = require('../steam/depot-scanner');
const { resolveSteamRoot } = require('../steam/config-reader');

async function testSteamRootResolution() {
  console.log('Testing Steam root resolution...');
  const result = await resolveSteamRoot();
  
  if (result.success) {
    console.log(`Found Steam installation: ${result.steamRoot}`);
  } else {
    console.error('Failed to find Steam installation');
  }
  
  if (result.errors.length > 0) {
    console.log('\nErrors/Warnings:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  return result;
}

async function testDepotScanner() {
  console.log('\nTesting depot scanner...');
  
  const options = {
    defaultAppId: '730',
    inferAppId: true
  };
  
  const result = await scanDepotCache(options);
  
  if (result.success) {
    console.log(`\nScan completed successfully!`);
    console.log(`Steam root: ${result.steamRoot}`);
    console.log(`Manifest files found: ${result.files.length}`);
    
    const validFiles = result.files.filter(f => f.status === 'valid');
    const invalidFiles = result.files.filter(f => f.status === 'invalid');
    
    console.log(`Valid files: ${validFiles.length}`);
    console.log(`Invalid files: ${invalidFiles.length}`);
    
    const typeGroups = {};
    result.files.forEach(f => {
      typeGroups[f.type] = (typeGroups[f.type] || 0) + 1;
    });
    
    console.log('\nFiles by type:');
    Object.entries(typeGroups).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    if (result.files.length > 0 && result.files.length <= 10) {
      console.log('\nSample files:');
      result.files.slice(0, 5).forEach(f => {
        console.log(`  - ${f.name}`);
        console.log(`    Manifest ID: ${f.manifestId}, Depot ID: ${f.depotId}, App ID: ${f.appId}`);
        console.log(`    Decryption Key: ${f.decryptionKey || 'N/A'}`);
        console.log(`    Location: ${f.location}`);
        console.log(`    Type: ${f.type}, Status: ${f.status}`);
        if (f.errors.length > 0) {
          console.log(`    Errors: ${f.errors.join(', ')}`);
        }
      });
    }
  }
  
  if (result.warnings && result.warnings.length > 0) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    result.warnings.slice(0, 10).forEach(warn => console.log(`  - ${warn}`));
    if (result.warnings.length > 10) {
      console.log(`  ... and ${result.warnings.length - 10} more`);
    }
  } else {
    console.error('Scan failed!');
  }
  
  if (result.errors.length > 0) {
    console.log(`\nErrors/Warnings (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }
  
  return result;
}

async function main() {
  try {
    await testSteamRootResolution();
    await testDepotScanner();
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testSteamRootResolution, testDepotScanner };
