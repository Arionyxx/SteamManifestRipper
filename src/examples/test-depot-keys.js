const path = require('path');
const { parseDepotKeys } = require('../steam/config-reader');

async function testDepotKeyExtraction() {
  console.log('=== Testing Depot Key Extraction ===\n');
  
  // Test with fixture files first
  const fixturePath201790 = path.join(__dirname, '..', 'tests', 'fixtures', 'sample-config-201790.vdf');
  console.log('Testing with fixture file:', fixturePath201790);
  console.log('---');
  
  const fixtureResult = await parseDepotKeys(fixturePath201790);
  console.log('\nFixture Result:');
  console.log('Found keys for depots:', Object.keys(fixtureResult.depotKeys));
  console.log('Depot 201791 key:', fixtureResult.depotKeys['201791']);
  console.log('Depot 413151 key:', fixtureResult.depotKeys['413151']);
  console.log('Depot 594653 key:', fixtureResult.depotKeys['594653']);
  console.log('Errors:', fixtureResult.errors);
  
  // Test with real Steam config.vdf if it exists
  console.log('\n\n=== Testing with Real Steam Config ===\n');
  const realConfigPath = 'C:\\Program Files (x86)\\Steam\\config\\config.vdf';
  console.log('Attempting to read from:', realConfigPath);
  console.log('---');
  
  const realResult = await parseDepotKeys(realConfigPath);
  console.log('\nReal Config Result:');
  console.log('Total depot keys found:', Object.keys(realResult.depotKeys).length);
  console.log('Found keys for depots:', Object.keys(realResult.depotKeys).slice(0, 20)); // Show first 20
  if (Object.keys(realResult.depotKeys).length > 20) {
    console.log('... and', Object.keys(realResult.depotKeys).length - 20, 'more');
  }
  
  // Check for specific depots mentioned in the ticket
  console.log('\nChecking for specific depot IDs:');
  console.log('Depot 201791:', realResult.depotKeys['201791'] ? 'FOUND - ' + realResult.depotKeys['201791'].substring(0, 16) + '...' : 'NOT FOUND');
  console.log('Depot 413151:', realResult.depotKeys['413151'] ? 'FOUND - ' + realResult.depotKeys['413151'].substring(0, 16) + '...' : 'NOT FOUND');
  
  console.log('\nErrors:', realResult.errors);
}

// Run the test
testDepotKeyExtraction().then(() => {
  console.log('\n=== Test Complete ===');
}).catch(error => {
  console.error('Test failed with error:', error);
  console.error(error.stack);
});
