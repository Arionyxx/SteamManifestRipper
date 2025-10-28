const path = require('path');
const fs = require('fs').promises;
const { extractInstalledDepots, classifyDepot } = require('../steam/app-loader');

function testExtractInstalledDepots() {
  console.log('Testing depot extraction from appmanifest...');
  
  const mockAppState = {
    InstalledDepots: {
      '228980': {
        manifest: '1234567890123456789'
      },
      '228982': {
        manifest: '9876543210987654321'
      },
      '228990': {
        manifest: '5555555555555555555'
      }
    }
  };
  
  const depots = extractInstalledDepots(mockAppState);
  
  console.log('Extracted depots:', depots);
  
  if (depots.length === 3 &&
      depots.some(d => d.depotId === '228980' && d.manifestId === '1234567890123456789') &&
      depots.some(d => d.depotId === '228982' && d.manifestId === '9876543210987654321') &&
      depots.some(d => d.depotId === '228990' && d.manifestId === '5555555555555555555')) {
    console.log('✓ Depot extraction works correctly');
    return true;
  } else {
    console.error('✗ Depot extraction failed');
    console.error('Expected 3 depots, got:', depots.length);
    return false;
  }
}

function testExtractInstalledDepotsEmpty() {
  console.log('\nTesting depot extraction with empty appmanifest...');
  
  const mockAppState = {
    InstalledDepots: {}
  };
  
  const depots = extractInstalledDepots(mockAppState);
  
  console.log('Extracted depots:', depots);
  
  if (depots.length === 0) {
    console.log('✓ Empty depot extraction works correctly');
    return true;
  } else {
    console.error('✗ Empty depot extraction failed');
    return false;
  }
}

function testClassifyDepot() {
  console.log('\nTesting depot classification (Main vs DLC)...');
  
  const testCases = [
    { depotId: '228980', appId: '228980', expected: 'main' },
    { depotId: '228982', appId: '228980', expected: 'main' },
    { depotId: '228990', appId: '228980', expected: 'main' },
    { depotId: '100000', appId: '228980', expected: 'main' },
    { depotId: '329081', appId: '228980', expected: 'dlc' },
    { depotId: '400000', appId: '228980', expected: 'dlc' },
    { depotId: '500000', appId: '400000', expected: 'main' },
    { depotId: '600001', appId: '400000', expected: 'dlc' },
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    const result = classifyDepot(testCase.depotId, testCase.appId);
    
    console.log(`Depot ${testCase.depotId} for App ${testCase.appId}: ${result} (expected: ${testCase.expected})`);
    
    if (result !== testCase.expected) {
      console.error(`  ✗ Classification failed`);
      allPassed = false;
    } else {
      console.log(`  ✓ Classification correct`);
    }
  }
  
  if (allPassed) {
    console.log('✓ All depot classifications passed');
  } else {
    console.error('✗ Some depot classifications failed');
  }
  
  return allPassed;
}

function testClassifyDepotEdgeCases() {
  console.log('\nTesting depot classification edge cases...');
  
  const testCases = [
    { depotId: '228980', appId: '128979', expected: 'dlc' },
    { depotId: '228980', appId: '228880', expected: 'main' },
    { depotId: 'invalid', appId: '228980', expected: 'unknown' },
    { depotId: '228980', appId: 'invalid', expected: 'unknown' },
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    const result = classifyDepot(testCase.depotId, testCase.appId);
    
    console.log(`Depot ${testCase.depotId} for App ${testCase.appId}: ${result} (expected: ${testCase.expected})`);
    
    if (result !== testCase.expected) {
      console.error(`  ✗ Classification failed`);
      allPassed = false;
    } else {
      console.log(`  ✓ Classification correct`);
    }
  }
  
  if (allPassed) {
    console.log('✓ All edge case classifications passed');
  } else {
    console.error('✗ Some edge case classifications failed');
  }
  
  return allPassed;
}

async function runTests() {
  console.log('=== App Loader Tests ===\n');
  
  const results = await Promise.all([
    Promise.resolve(testExtractInstalledDepots()),
    Promise.resolve(testExtractInstalledDepotsEmpty()),
    Promise.resolve(testClassifyDepot()),
    Promise.resolve(testClassifyDepotEdgeCases())
  ]);
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n=== Results: ${passed}/${total} tests passed ===`);
  
  return passed === total;
}

if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runTests };
