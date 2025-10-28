const path = require('path');
const fs = require('fs').promises;
const { parseDepotKeys } = require('../steam/config-reader');

async function testFallbackParsing() {
  console.log('=== Testing Fallback Parsing ===\n');
  
  // Create a test file that might confuse the standard VDF parser
  // but should work with the regex/line-by-line fallback
  const testContent = `"InstallConfigStore"
{
    "Software"
    {
        "Valve"
        {
            "Steam"
            {
                "depots"
                {
                    "201791"
                    {
                        "DecryptionKey"		"07e18a6715cee99f3c872f9fc3f7484243f7bf6c8dcbf57bebd21c3ed7e8e08a"
                    }
                    "413151"
                    {
                        "DecryptionKey"		"ff71699a17787b798d901cb27398556eb69a498b690b4392b2ffedcacc1019ff"
                    }
                }
            }
        }
    }
}`;

  const testPath = path.join(__dirname, 'test-fallback.vdf');
  
  try {
    // Write test file
    await fs.writeFile(testPath, testContent, 'utf8');
    console.log('Created test file:', testPath);
    console.log('---\n');
    
    // Parse it
    const result = await parseDepotKeys(testPath);
    
    console.log('\n--- Results ---');
    console.log('Depot keys found:', Object.keys(result.depotKeys).length);
    console.log('Depot IDs:', Object.keys(result.depotKeys));
    console.log('Depot 201791:', result.depotKeys['201791']);
    console.log('Depot 413151:', result.depotKeys['413151']);
    console.log('Errors:', result.errors);
    
    // Clean up
    await fs.unlink(testPath);
    console.log('\n✓ Test completed and cleanup done');
    
  } catch (error) {
    console.error('Test failed:', error);
    // Try to clean up even if test failed
    try {
      await fs.unlink(testPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

testFallbackParsing();
