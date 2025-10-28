const assert = require('assert');

function generateLuaOutput(state) {
  const depotsWithKeys = state.depots.filter(d => d.decryptionKey);
  
  if (depotsWithKeys.length === 0) {
    return '-- No depots with decryption keys available\n-- Load an app manifest with valid depot keys to generate output';
  }
  
  let output = `-- Generated Lua script for App ID: ${state.appId}\n`;
  if (state.appName) {
    output += `-- App Name: ${state.appName}\n`;
  }
  output += `-- Generated: ${new Date().toISOString()}\n`;
  output += `-- Include DLC: ${state.includeDlc ? 'Yes' : 'No'}\n\n`;
  
  const mainDepots = depotsWithKeys.filter(d => d.type === 'main');
  const dlcDepots = depotsWithKeys.filter(d => d.type === 'dlc');
  
  output += `addappid(${state.appId})\n`;
  
  if (mainDepots.length > 0) {
    const mainDepot = mainDepots[0];
    output += `setManifestid(${state.appId}, "${mainDepot.manifestId}")\n`;
  }
  
  output += '\n';
  
  const depotsToInclude = state.includeDlc ? depotsWithKeys : mainDepots;
  
  for (const depot of depotsToInclude) {
    output += `addappid(${depot.depotId}, 0, "${depot.decryptionKey}")\n`;
    output += `setManifestid(${depot.depotId}, "${depot.manifestId}")\n`;
  }
  
  return output;
}

function testLuaGenerationWithMainDepot() {
  const state = {
    appId: '123456',
    appName: 'Test Game',
    includeDlc: true,
    depots: [
      {
        depotId: '123457',
        manifestId: '7890123456',
        type: 'main',
        decryptionKey: 'ABCD1234EFGH5678'
      }
    ]
  };
  
  const output = generateLuaOutput(state);
  
  assert(output.includes('addappid(123456)'), 'Should include main app ID');
  assert(output.includes('setManifestid(123456, "7890123456")'), 'Should set manifest for main app');
  assert(output.includes('addappid(123457, 0, "ABCD1234EFGH5678")'), 'Should add depot with key');
  assert(output.includes('setManifestid(123457, "7890123456")'), 'Should set manifest for depot');
  
  console.log('✓ testLuaGenerationWithMainDepot passed');
}

function testLuaGenerationWithDLC() {
  const state = {
    appId: '123456',
    appName: 'Test Game',
    includeDlc: true,
    depots: [
      {
        depotId: '123457',
        manifestId: '7890123456',
        type: 'main',
        decryptionKey: 'MAINKEY123'
      },
      {
        depotId: '234567',
        manifestId: '8901234567',
        type: 'dlc',
        decryptionKey: 'DLCKEY456'
      }
    ]
  };
  
  const output = generateLuaOutput(state);
  
  assert(output.includes('addappid(234567, 0, "DLCKEY456")'), 'Should include DLC depot when includeDlc is true');
  assert(output.includes('setManifestid(234567, "8901234567")'), 'Should set manifest for DLC depot');
  
  console.log('✓ testLuaGenerationWithDLC passed');
}

function testLuaGenerationExcludeDLC() {
  const state = {
    appId: '123456',
    appName: 'Test Game',
    includeDlc: false,
    depots: [
      {
        depotId: '123457',
        manifestId: '7890123456',
        type: 'main',
        decryptionKey: 'MAINKEY123'
      },
      {
        depotId: '234567',
        manifestId: '8901234567',
        type: 'dlc',
        decryptionKey: 'DLCKEY456'
      }
    ]
  };
  
  const output = generateLuaOutput(state);
  
  assert(!output.includes('DLCKEY456'), 'Should not include DLC depot when includeDlc is false');
  assert(!output.includes('234567'), 'Should not include DLC depot ID when includeDlc is false');
  assert(output.includes('MAINKEY123'), 'Should include main depot');
  
  console.log('✓ testLuaGenerationExcludeDLC passed');
}

function testLuaGenerationSkipMissingKeys() {
  const state = {
    appId: '123456',
    appName: 'Test Game',
    includeDlc: true,
    depots: [
      {
        depotId: '123457',
        manifestId: '7890123456',
        type: 'main',
        decryptionKey: 'MAINKEY123'
      },
      {
        depotId: '234567',
        manifestId: '8901234567',
        type: 'dlc',
        decryptionKey: ''
      }
    ]
  };
  
  const output = generateLuaOutput(state);
  
  assert(output.includes('MAINKEY123'), 'Should include depot with key');
  assert(!output.includes('234567'), 'Should skip depot without key');
  
  console.log('✓ testLuaGenerationSkipMissingKeys passed');
}

function testLuaGenerationNoDepotsWithKeys() {
  const state = {
    appId: '123456',
    appName: 'Test Game',
    includeDlc: true,
    depots: [
      {
        depotId: '123457',
        manifestId: '7890123456',
        type: 'main',
        decryptionKey: ''
      }
    ]
  };
  
  const output = generateLuaOutput(state);
  
  assert(output.includes('No depots with decryption keys available'), 'Should return message when no keys available');
  
  console.log('✓ testLuaGenerationNoDepotsWithKeys passed');
}

function testLuaGenerationFormat() {
  const state = {
    appId: '123456',
    appName: 'Test Game',
    includeDlc: true,
    depots: [
      {
        depotId: '123457',
        manifestId: '7890123456',
        type: 'main',
        decryptionKey: 'KEY123'
      }
    ]
  };
  
  const output = generateLuaOutput(state);
  const lines = output.split('\n');
  
  let foundAddAppId = false;
  let foundSetManifestMain = false;
  let foundAddDepot = false;
  let foundSetManifestDepot = false;
  
  for (const line of lines) {
    if (line.includes('addappid(123456)') && !line.includes('0')) {
      foundAddAppId = true;
    }
    if (line.includes('setManifestid(123456,')) {
      foundSetManifestMain = true;
    }
    if (line.includes('addappid(123457, 0, "KEY123")')) {
      foundAddDepot = true;
    }
    if (line.includes('setManifestid(123457,')) {
      foundSetManifestDepot = true;
    }
  }
  
  assert(foundAddAppId, 'Should have addappid for main app');
  assert(foundSetManifestMain, 'Should have setManifestid for main app');
  assert(foundAddDepot, 'Should have addappid for depot with key');
  assert(foundSetManifestDepot, 'Should have setManifestid for depot');
  
  console.log('✓ testLuaGenerationFormat passed');
}

function runTests() {
  console.log('Running renderer tests...\n');
  
  try {
    testLuaGenerationWithMainDepot();
    testLuaGenerationWithDLC();
    testLuaGenerationExcludeDLC();
    testLuaGenerationSkipMissingKeys();
    testLuaGenerationNoDepotsWithKeys();
    testLuaGenerationFormat();
    
    console.log('\nAll renderer tests passed! ✓');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
