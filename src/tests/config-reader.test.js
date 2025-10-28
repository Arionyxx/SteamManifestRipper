const path = require('path');
const fs = require('fs').promises;
const { parseDepotKeys, resolveSteamRoot } = require('../steam/config-reader');
const { parseVDF } = require('../parsers/vdf-parser');

function testParseDepotKeys() {
  console.log('Testing depot key extraction...');
  
  const fixturePath = path.join(__dirname, 'fixtures', 'sample-config.vdf');
  
  return parseDepotKeys(fixturePath).then(result => {
    const { depotKeys, errors } = result;
    
    console.log('Extracted depot keys:', depotKeys);
    console.log('Errors:', errors);
    
    if (depotKeys['228980'] === 'ABCDEF1234567890ABCDEF1234567890' &&
        depotKeys['228982'] === '1234567890ABCDEF1234567890ABCDEF' &&
        depotKeys['731'] === 'FEDCBA0987654321FEDCBA0987654321' &&
        depotKeys['732'] === '0F1E2D3C4B5A69780F1E2D3C4B5A6978' &&
        Object.keys(depotKeys).length === 4) {
      console.log('✓ Depot key extraction works correctly');
      return true;
    } else {
      console.error('✗ Depot key extraction failed');
      console.error('Expected 4 keys, got:', Object.keys(depotKeys).length);
      return false;
    }
  }).catch(error => {
    console.error('✗ Test threw error:', error.message);
    return false;
  });
}

function testMissingConfigFile() {
  console.log('\nTesting missing config file handling...');
  
  const nonExistentPath = path.join(__dirname, 'fixtures', 'non-existent.vdf');
  
  return parseDepotKeys(nonExistentPath).then(result => {
    const { depotKeys, errors } = result;
    
    console.log('Depot keys:', depotKeys);
    console.log('Errors:', errors);
    
    if (Object.keys(depotKeys).length === 0 && errors.length > 0) {
      console.log('✓ Missing config file handled gracefully');
      return true;
    } else {
      console.error('✗ Missing config file not handled correctly');
      return false;
    }
  }).catch(error => {
    console.error('✗ Test threw error:', error.message);
    return false;
  });
}

function testEmptyConfigFile() {
  console.log('\nTesting empty config structure...');
  
  const tempPath = path.join(__dirname, 'fixtures', 'temp-empty.vdf');
  const emptyContent = '"EmptyRoot"\n{\n}\n';
  
  return fs.writeFile(tempPath, emptyContent, 'utf8')
    .then(() => parseDepotKeys(tempPath))
    .then(result => {
      const { depotKeys, errors } = result;
      
      console.log('Depot keys:', depotKeys);
      console.log('Errors:', errors);
      
      return fs.unlink(tempPath).then(() => {
        if (Object.keys(depotKeys).length === 0) {
          console.log('✓ Empty config structure handled gracefully');
          return true;
        } else {
          console.error('✗ Empty config structure not handled correctly');
          return false;
        }
      });
    })
    .catch(error => {
      return fs.unlink(tempPath).catch(() => {}).then(() => {
        console.error('✗ Test threw error:', error.message);
        return false;
      });
    });
}

function testManifestFilenameExtraction() {
  console.log('\nTesting manifest ID and depot ID extraction...');
  
  const { extractManifestId, extractDepotId } = require('../steam/depot-scanner');
  
  const testCases = [
    {
      filename: '228980_1234567890123456789.manifest',
      expectedDepotId: '228980',
      expectedManifestId: '1234567890123456789'
    },
    {
      filename: '731_7388888888888888888.manifest',
      expectedDepotId: '731',
      expectedManifestId: '7388888888888888888'
    },
    {
      filename: 'depot_12345_9876543210987654321.manifest',
      expectedDepotId: '12345',
      expectedManifestId: '9876543210987654321'
    },
    {
      filename: '456_123_9999999999.manifest',
      expectedDepotId: '456',
      expectedManifestId: '9999999999'
    }
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    const manifestId = extractManifestId(testCase.filename);
    const depotId = extractDepotId(testCase.filename);
    
    console.log(`File: ${testCase.filename}`);
    console.log(`  Expected Depot ID: ${testCase.expectedDepotId}, Got: ${depotId}`);
    console.log(`  Expected Manifest ID: ${testCase.expectedManifestId}, Got: ${manifestId}`);
    
    if (manifestId !== testCase.expectedManifestId || depotId !== testCase.expectedDepotId) {
      console.error(`  ✗ Extraction failed for ${testCase.filename}`);
      allPassed = false;
    } else {
      console.log(`  ✓ Extraction correct`);
    }
  }
  
  if (allPassed) {
    console.log('✓ All manifest filename extractions passed');
  } else {
    console.error('✗ Some manifest filename extractions failed');
  }
  
  return Promise.resolve(allPassed);
}

function testInvalidHexKeys() {
  console.log('\nTesting invalid hex key filtering...');
  
  const tempPath = path.join(__dirname, 'fixtures', 'temp-invalid-keys.vdf');
  const invalidContent = `
"InstallConfigStore"
{
  "Software"
  {
    "Valve"
    {
      "Steam"
      {
        "depots"
        {
          "123"
          {
            "DecryptionKey"    "ABC123456789DEF0"
          }
          "456"
          {
            "DecryptionKey"    "INVALID KEY WITH SPACES"
          }
          "789"
          {
            "DecryptionKey"    "ABCDEF"
          }
          "999"
          {
            "DecryptionKey"    "NOT-HEX-CHARS"
          }
        }
      }
    }
  }
}
`;
  
  return fs.writeFile(tempPath, invalidContent, 'utf8')
    .then(() => parseDepotKeys(tempPath))
    .then(result => {
      const { depotKeys, errors } = result;
      
      console.log('Depot keys:', depotKeys);
      console.log('Errors:', errors);
      
      return fs.unlink(tempPath).then(() => {
        if (depotKeys['123'] === 'ABC123456789DEF0' &&
            depotKeys['789'] === 'ABCDEF' &&
            !depotKeys['456'] &&
            !depotKeys['999'] &&
            Object.keys(depotKeys).length === 2) {
          console.log('✓ Invalid hex keys filtered correctly');
          return true;
        } else {
          console.error('✗ Invalid hex key filtering failed');
          console.error('Expected 2 valid keys (123 and 789), got:', Object.keys(depotKeys).length);
          return false;
        }
      });
    })
    .catch(error => {
      return fs.unlink(tempPath).catch(() => {}).then(() => {
        console.error('✗ Test threw error:', error.message);
        return false;
      });
    });
}

function testRealWorldDepotKeys() {
  console.log('\nTesting real-world depot keys with 64-character hex...');
  
  const fixturePath = path.join(__dirname, 'fixtures', 'sample-config-201790.vdf');
  
  return parseDepotKeys(fixturePath).then(result => {
    const { depotKeys, errors } = result;
    
    console.log('Extracted depot keys:', depotKeys);
    console.log('Errors:', errors);
    
    // Check for the specific depot IDs mentioned in the ticket
    const expectedKeys = {
      '201791': '07e18a6715cee99f3c872f9fc3f7484243f7bf6c8dcbf57bebd21c3ed7e8e08a',
      '413151': 'ff71699a17787b798d901cb27398556eb69a498b690b4392b2ffedcacc1019ff',
      '594653': 'abc123def456789012345678901234567890abcdef1234567890123456789012'
    };
    
    let allMatch = true;
    for (const [depotId, expectedKey] of Object.entries(expectedKeys)) {
      if (depotKeys[depotId] !== expectedKey) {
        console.error(`✗ Key mismatch for depot ${depotId}`);
        console.error(`  Expected: ${expectedKey}`);
        console.error(`  Got: ${depotKeys[depotId]}`);
        allMatch = false;
      }
    }
    
    if (allMatch && Object.keys(depotKeys).length === 3) {
      console.log('✓ Real-world depot keys extracted correctly');
      console.log('  - 64-character hex keys validated');
      console.log('  - Depot IDs 201791, 413151, 594653 found');
      return true;
    } else {
      console.error('✗ Real-world depot key extraction failed');
      return false;
    }
  }).catch(error => {
    console.error('✗ Test threw error:', error.message);
    return false;
  });
}

async function runTests() {
  console.log('=== Config Reader Tests ===\n');
  
  await fs.mkdir(path.join(__dirname, 'fixtures'), { recursive: true });
  
  const results = await Promise.all([
    testParseDepotKeys(),
    testMissingConfigFile(),
    testEmptyConfigFile(),
    testManifestFilenameExtraction(),
    testInvalidHexKeys(),
    testRealWorldDepotKeys()
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
