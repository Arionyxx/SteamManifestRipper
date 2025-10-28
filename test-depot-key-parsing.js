// Test script to demonstrate depot key parsing for app 201790
// This tests the fix for the config.vdf depot key parsing issue

const { parseDepotKeys } = require('./src/steam/config-reader');
const path = require('path');

async function testDepotKeyParsing() {
  console.log('=== Testing Depot Key Parsing Fix ===\n');
  
  // Test with the sample config that has depot IDs from the ticket
  const configPath = path.join(__dirname, 'src', 'tests', 'fixtures', 'sample-config-201790.vdf');
  
  console.log(`Testing with: ${configPath}\n`);
  
  const result = await parseDepotKeys(configPath);
  
  if (result.errors.length > 0) {
    console.error('Errors encountered:');
    result.errors.forEach(err => console.error('  - ' + err));
    return false;
  }
  
  console.log('Extracted Depot Keys:');
  console.log('---------------------');
  
  const expectedDepots = {
    '201791': '07e18a6715cee99f3c872f9fc3f7484243f7bf6c8dcbf57bebd21c3ed7e8e08a',
    '413151': 'ff71699a17787b798d901cb27398556eb69a498b690b4392b2ffedcacc1019ff',
    '594653': 'abc123def456789012345678901234567890abcdef1234567890123456789012'
  };
  
  let allFound = true;
  
  for (const [depotId, expectedKey] of Object.entries(expectedDepots)) {
    const actualKey = result.depotKeys[depotId];
    
    if (!actualKey) {
      console.error(`✗ Depot ${depotId}: NOT FOUND (this was the bug!)`);
      allFound = false;
    } else if (actualKey === expectedKey) {
      console.log(`✓ Depot ${depotId}: ${actualKey.substring(0, 16)}...`);
    } else {
      console.error(`✗ Depot ${depotId}: Key mismatch`);
      console.error(`    Expected: ${expectedKey}`);
      console.error(`    Got:      ${actualKey}`);
      allFound = false;
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total depot keys found: ${Object.keys(result.depotKeys).length}`);
  
  if (allFound && Object.keys(result.depotKeys).length === 3) {
    console.log('✓ All depot keys extracted successfully!');
    console.log('✓ 64-character hex keys validated');
    console.log('✓ Config.vdf parsing is working correctly');
    return true;
  } else {
    console.error('✗ Depot key extraction failed');
    return false;
  }
}

// Run the test
if (require.main === module) {
  testDepotKeyParsing().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test failed with error:', error.message);
    process.exit(1);
  });
}

module.exports = { testDepotKeyParsing };
