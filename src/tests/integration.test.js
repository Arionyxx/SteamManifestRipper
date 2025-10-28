const path = require('path');
const fs = require('fs').promises;
const { scanDepotCache } = require('../steam/depot-scanner');

async function setupTestEnvironment() {
  const testRoot = path.join(__dirname, 'fixtures', 'test-steam-root');
  
  await fs.mkdir(path.join(testRoot, 'depotcache'), { recursive: true });
  await fs.mkdir(path.join(testRoot, 'config', 'depotcache'), { recursive: true });
  await fs.mkdir(path.join(testRoot, 'steamapps'), { recursive: true });
  
  await fs.writeFile(
    path.join(testRoot, 'depotcache', '228980_1234567890123456789.manifest'),
    'dummy manifest content',
    'utf8'
  );
  
  await fs.writeFile(
    path.join(testRoot, 'config', 'depotcache', '731_9876543210987654321.manifest'),
    'dummy manifest content',
    'utf8'
  );
  
  const configVdf = `
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
          "228980"
          {
            "DecryptionKey"    "ABCDEF1234567890ABCDEF1234567890"
          }
          "731"
          {
            "DecryptionKey"    "FEDCBA0987654321FEDCBA0987654321"
          }
        }
      }
    }
  }
}
`;
  
  await fs.writeFile(
    path.join(testRoot, 'config', 'config.vdf'),
    configVdf,
    'utf8'
  );
  
  const appManifest = `
"AppState"
{
  "appid"   "730"
  "name"    "Counter-Strike: Global Offensive"
  "DepotState"
  {
    "731"
    {
      "manifest"   "9876543210987654321"
    }
  }
}
`;
  
  await fs.writeFile(
    path.join(testRoot, 'steamapps', 'appmanifest_730.acf'),
    appManifest,
    'utf8'
  );
  
  return testRoot;
}

async function cleanupTestEnvironment(testRoot) {
  await fs.rm(testRoot, { recursive: true, force: true });
}

async function testIntegratedScanning() {
  console.log('Testing integrated depot scanning...');
  
  let testRoot;
  try {
    testRoot = await setupTestEnvironment();
    
    const result = await scanDepotCache({
      steamPathOverride: testRoot,
      inferAppId: true
    });
    
    console.log('Scan result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      console.error('✗ Scan failed');
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (result.files.length !== 2) {
      console.error(`✗ Expected 2 manifest files, got ${result.files.length}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    const manifest1 = result.files.find(f => f.depotId === '228980');
    const manifest2 = result.files.find(f => f.depotId === '731');
    
    if (!manifest1) {
      console.error('✗ Manifest for depot 228980 not found');
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (!manifest2) {
      console.error('✗ Manifest for depot 731 not found');
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (manifest1.decryptionKey !== 'ABCDEF1234567890ABCDEF1234567890') {
      console.error(`✗ Wrong decryption key for depot 228980: ${manifest1.decryptionKey}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (manifest2.decryptionKey !== 'FEDCBA0987654321FEDCBA0987654321') {
      console.error(`✗ Wrong decryption key for depot 731: ${manifest2.decryptionKey}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (manifest1.manifestId !== '1234567890123456789') {
      console.error(`✗ Wrong manifest ID for depot 228980: ${manifest1.manifestId}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (manifest2.manifestId !== '9876543210987654321') {
      console.error(`✗ Wrong manifest ID for depot 731: ${manifest2.manifestId}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (manifest2.appId !== '730') {
      console.error(`✗ App ID not inferred correctly for depot 731: ${manifest2.appId}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    const manifest1Location = manifest1.location.replace(/\\/g, '/');
    if (!manifest1Location.endsWith('/depotcache')) {
      console.error(`✗ Wrong location for manifest 1: ${manifest1.location}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    const manifest2Location = manifest2.location.replace(/\\/g, '/');
    if (!manifest2Location.endsWith('/config/depotcache')) {
      console.error(`✗ Wrong location for manifest 2: ${manifest2.location}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    console.log('✓ Integrated scanning works correctly');
    console.log('  - Both depotcache locations scanned');
    console.log('  - Decryption keys attached correctly');
    console.log('  - Manifest IDs extracted correctly');
    console.log('  - App IDs inferred correctly');
    console.log('  - Locations tracked correctly');
    
    await cleanupTestEnvironment(testRoot);
    return true;
    
  } catch (error) {
    console.error('✗ Test threw error:', error.message);
    console.error(error.stack);
    if (testRoot) {
      await cleanupTestEnvironment(testRoot);
    }
    return false;
  }
}

async function testMissingKeyWarning() {
  console.log('\nTesting missing decryption key warning...');
  
  let testRoot;
  try {
    testRoot = path.join(__dirname, 'fixtures', 'test-steam-root-nokey');
    
    await fs.mkdir(path.join(testRoot, 'depotcache'), { recursive: true });
    await fs.mkdir(path.join(testRoot, 'config'), { recursive: true });
    await fs.mkdir(path.join(testRoot, 'steamapps'), { recursive: true });
    
    await fs.writeFile(
      path.join(testRoot, 'depotcache', '999_1234567890123456789.manifest'),
      'dummy manifest content',
      'utf8'
    );
    
    const configVdf = `
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
        }
      }
    }
  }
}
`;
    
    await fs.writeFile(
      path.join(testRoot, 'config', 'config.vdf'),
      configVdf,
      'utf8'
    );
    
    const result = await scanDepotCache({
      steamPathOverride: testRoot,
      inferAppId: false
    });
    
    console.log('Warnings:', result.warnings);
    
    if (!result.success) {
      console.error('✗ Scan failed');
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (result.warnings.length === 0) {
      console.error('✗ Expected warning for missing decryption key');
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    const hasKeyWarning = result.warnings.some(w => 
      w.includes('No decryption key found for depot 999')
    );
    
    if (!hasKeyWarning) {
      console.error('✗ Missing key warning not found');
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    console.log('✓ Missing decryption key warning generated correctly');
    
    await cleanupTestEnvironment(testRoot);
    return true;
    
  } catch (error) {
    console.error('✗ Test threw error:', error.message);
    console.error(error.stack);
    if (testRoot) {
      await cleanupTestEnvironment(testRoot);
    }
    return false;
  }
}

async function runTests() {
  console.log('=== Integration Tests ===\n');
  
  const results = await Promise.all([
    testIntegratedScanning(),
    testMissingKeyWarning()
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
