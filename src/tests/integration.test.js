const path = require('path');
const fs = require('fs').promises;
const { loadAppData } = require('../steam/app-loader');
const { copyManifests } = require('../steam/manifest-copier');

async function setupTestEnvironment() {
  const testRoot = path.join(__dirname, 'fixtures', 'test-steam-root');
  
  await fs.mkdir(path.join(testRoot, 'steamapps', 'depotcache'), { recursive: true });
  await fs.mkdir(path.join(testRoot, 'config'), { recursive: true });
  
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
          "228982"
          {
            "DecryptionKey"    "1234567890ABCDEF1234567890ABCDEF"
          }
          "228990"
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
  "appid"   "228980"
  "name"    "Steamworks Common Redistributables"
  "InstalledDepots"
  {
    "228980"
    {
      "manifest"   "1234567890123456789"
    }
    "228982"
    {
      "manifest"   "9876543210987654321"
    }
    "228990"
    {
      "manifest"   "5555555555555555555"
    }
    "329081"
    {
      "manifest"   "7777777777777777777"
    }
  }
}
`;
  
  await fs.writeFile(
    path.join(testRoot, 'steamapps', 'appmanifest_228980.acf'),
    appManifest,
    'utf8'
  );
  
  await fs.writeFile(
    path.join(testRoot, 'steamapps', 'depotcache', '228980_1234567890123456789.manifest'),
    'dummy manifest content',
    'utf8'
  );
  
  await fs.writeFile(
    path.join(testRoot, 'steamapps', 'depotcache', '228982_9876543210987654321.manifest'),
    'dummy manifest content',
    'utf8'
  );
  
  await fs.writeFile(
    path.join(testRoot, 'steamapps', 'depotcache', '228990_5555555555555555555.manifest'),
    'dummy manifest content',
    'utf8'
  );
  
  const libraryFoldersVdf = `
"libraryfolders"
{
  "0"
  {
    "path"    "${testRoot.replace(/\\/g, '\\\\')}"
  }
}
`;
  
  await fs.writeFile(
    path.join(testRoot, 'steamapps', 'libraryfolders.vdf'),
    libraryFoldersVdf,
    'utf8'
  );
  
  return testRoot;
}

async function cleanupTestEnvironment(testRoot) {
  await fs.rm(testRoot, { recursive: true, force: true });
}

async function testLoadAppData() {
  console.log('Testing loadAppData integration...');
  
  let testRoot;
  try {
    testRoot = await setupTestEnvironment();
    
    const result = await loadAppData({
      appId: '228980',
      includeDlc: true,
      steamPathOverride: testRoot
    });
    
    console.log('Load result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      console.error('✗ Load failed');
      console.error('Errors:', result.errors);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (result.appName !== 'Steamworks Common Redistributables') {
      console.error(`✗ Wrong app name: ${result.appName}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (result.depots.length !== 4) {
      console.error(`✗ Expected 4 depots, got ${result.depots.length}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    const depot228980 = result.depots.find(d => d.depotId === '228980');
    const depot228982 = result.depots.find(d => d.depotId === '228982');
    const depot228990 = result.depots.find(d => d.depotId === '228990');
    const depot329081 = result.depots.find(d => d.depotId === '329081');
    
    if (!depot228980 || depot228980.type !== 'main') {
      console.error('✗ Depot 228980 not classified as main');
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (!depot329081 || depot329081.type !== 'dlc') {
      console.error('✗ Depot 329081 not classified as DLC');
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (depot228980.decryptionKey !== 'ABCDEF1234567890ABCDEF1234567890') {
      console.error(`✗ Wrong decryption key for depot 228980: ${depot228980.decryptionKey}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (depot329081.decryptionKey !== '') {
      console.error(`✗ DLC depot should have empty key: ${depot329081.decryptionKey}`);
    }
    
    if (result.missingKeys.length !== 1 || result.missingKeys[0] !== '329081') {
      console.error(`✗ Missing keys not tracked correctly: ${JSON.stringify(result.missingKeys)}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    console.log('✓ App data loading works correctly');
    console.log('  - App name extracted');
    console.log('  - Depots extracted and classified');
    console.log('  - Decryption keys attached');
    console.log('  - Missing keys tracked');
    
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

async function testLoadAppDataWithoutDlc() {
  console.log('\nTesting loadAppData without DLC...');
  
  let testRoot;
  try {
    testRoot = await setupTestEnvironment();
    
    const result = await loadAppData({
      appId: '228980',
      includeDlc: false,
      steamPathOverride: testRoot
    });
    
    console.log('Load result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      console.error('✗ Load failed');
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    if (result.depots.length !== 3) {
      console.error(`✗ Expected 3 depots (no DLC), got ${result.depots.length}`);
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    const hasDlc = result.depots.some(d => d.type === 'dlc');
    if (hasDlc) {
      console.error('✗ DLC depots should be filtered out');
      await cleanupTestEnvironment(testRoot);
      return false;
    }
    
    console.log('✓ DLC filtering works correctly');
    
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

async function testCopyManifests() {
  console.log('\nTesting manifest copy integration...');
  
  let testRoot;
  let outputDir;
  try {
    testRoot = await setupTestEnvironment();
    outputDir = path.join(__dirname, 'fixtures', 'test-output');
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const result = await copyManifests({
      depots: [
        { depotId: '228980', manifestId: '1234567890123456789' },
        { depotId: '228982', manifestId: '9876543210987654321' },
        { depotId: '999999', manifestId: '1111111111111111111' }
      ],
      destination: outputDir,
      steamPathOverride: testRoot
    });
    
    console.log('Copy result:', JSON.stringify(result, null, 2));
    
    if (!result.success) {
      console.error('✗ Copy failed');
      await cleanupTestEnvironment(testRoot);
      await fs.rm(outputDir, { recursive: true, force: true });
      return false;
    }
    
    if (result.copied.length !== 2) {
      console.error(`✗ Expected 2 copied files, got ${result.copied.length}`);
      await cleanupTestEnvironment(testRoot);
      await fs.rm(outputDir, { recursive: true, force: true });
      return false;
    }
    
    if (result.missing.length !== 1) {
      console.error(`✗ Expected 1 missing file, got ${result.missing.length}`);
      await cleanupTestEnvironment(testRoot);
      await fs.rm(outputDir, { recursive: true, force: true });
      return false;
    }
    
    const copiedFile1 = path.join(outputDir, '228980_1234567890123456789.manifest');
    const copiedFile2 = path.join(outputDir, '228982_9876543210987654321.manifest');
    
    try {
      await fs.access(copiedFile1);
      await fs.access(copiedFile2);
    } catch (error) {
      console.error('✗ Copied files not found in destination');
      await cleanupTestEnvironment(testRoot);
      await fs.rm(outputDir, { recursive: true, force: true });
      return false;
    }
    
    console.log('✓ Manifest copying works correctly');
    console.log('  - Files copied to destination');
    console.log('  - Missing files tracked');
    
    await cleanupTestEnvironment(testRoot);
    await fs.rm(outputDir, { recursive: true, force: true });
    return true;
    
  } catch (error) {
    console.error('✗ Test threw error:', error.message);
    console.error(error.stack);
    if (testRoot) {
      await cleanupTestEnvironment(testRoot);
    }
    if (outputDir) {
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    }
    return false;
  }
}

async function runTests() {
  console.log('=== Integration Tests ===\n');
  
  const results = await Promise.all([
    testLoadAppData(),
    testLoadAppDataWithoutDlc(),
    testCopyManifests()
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
