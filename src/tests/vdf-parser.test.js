const { parseVDF, extractDepotIds, extractDLCIds } = require('../parsers/vdf-parser');

function testBasicVDF() {
  console.log('Testing basic VDF parsing...');
  
  const vdfContent = `
"libraryfolders"
{
  "0"
  {
    "path"    "C:\\\\Program Files (x86)\\\\Steam"
    "label"   ""
    "contentid"   "1234567890"
  }
  "1"
  {
    "path"    "D:\\\\SteamLibrary"
    "label"   "Games"
    "contentid"   "9876543210"
  }
}
`;
  
  const result = parseVDF(vdfContent);
  console.log('Parsed result:', JSON.stringify(result, null, 2));
  
  if (result.libraryfolders && result.libraryfolders['0']) {
    console.log('✓ Basic VDF parsing works');
    return true;
  } else {
    console.error('✗ Basic VDF parsing failed');
    return false;
  }
}

function testAppManifestVDF() {
  console.log('\nTesting appmanifest VDF parsing...');
  
  const appManifest = `
"AppState"
{
  "appid"   "730"
  "name"    "Counter-Strike: Global Offensive"
  "StateFlags"   "4"
  "installdir"   "Counter-Strike Global Offensive"
  "DepotState"
  {
    "731"
    {
      "manifest"   "7388888888888888888"
      "size"   "123456789"
    }
    "732"
    {
      "manifest"   "7388888888888888889"
      "size"   "987654321"
    }
  }
  "InstalledDepots"
  {
    "731"
    {
      "manifest"   "7388888888888888888"
    }
  }
}
`;
  
  const result = parseVDF(appManifest);
  console.log('Parsed result:', JSON.stringify(result, null, 2));
  
  const depotIds = extractDepotIds(result.AppState);
  console.log('Extracted depot IDs:', depotIds);
  
  if (depotIds.includes('731') && depotIds.includes('732')) {
    console.log('✓ Appmanifest parsing works');
    return true;
  } else {
    console.error('✗ Appmanifest parsing failed');
    return false;
  }
}

function testDLCExtraction() {
  console.log('\nTesting DLC extraction...');
  
  const appManifest = `
"AppState"
{
  "appid"   "730"
  "name"    "Counter-Strike: Global Offensive"
  "InstalledDLC"
  {
    "0"   "12345"
    "1"   "12346"
    "2"   "12347"
  }
}
`;
  
  const result = parseVDF(appManifest);
  console.log('Parsed result:', JSON.stringify(result, null, 2));
  
  const dlcIds = extractDLCIds(result.AppState);
  console.log('Extracted DLC IDs:', dlcIds);
  
  if (dlcIds.length === 3) {
    console.log('✓ DLC extraction works');
    return true;
  } else {
    console.error('✗ DLC extraction failed');
    return false;
  }
}

function runTests() {
  console.log('=== VDF Parser Tests ===\n');
  
  const results = [
    testBasicVDF(),
    testAppManifestVDF(),
    testDLCExtraction()
  ];
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n=== Results: ${passed}/${total} tests passed ===`);
  
  return passed === total;
}

if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests };
