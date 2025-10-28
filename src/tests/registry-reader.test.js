const { queryWindowsRegistry } = require('../steam/registry-reader');

async function testRegistryQueryNonWindows() {
  console.log('Testing registry query on non-Windows platforms...');
  
  if (process.platform === 'win32') {
    console.log('⊘ Skipped (running on Windows)');
    return true;
  }
  
  const result = await queryWindowsRegistry(
    'HKLM\\SOFTWARE\\Valve\\Steam',
    'InstallPath'
  );
  
  console.log('Result:', result);
  
  if (!result.success && result.error && result.error.includes('Not running on Windows')) {
    console.log('✓ Registry query correctly returns error on non-Windows');
    return true;
  } else {
    console.error('✗ Registry query should fail on non-Windows');
    return false;
  }
}

async function testRegistryQueryWindows() {
  console.log('\nTesting registry query on Windows platforms...');
  
  if (process.platform !== 'win32') {
    console.log('⊘ Skipped (not running on Windows)');
    return true;
  }
  
  const result = await queryWindowsRegistry(
    'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam',
    'InstallPath'
  );
  
  console.log('Result:', result);
  
  if (result.success && result.value) {
    console.log(`✓ Registry query returned Steam path: ${result.value}`);
    return true;
  } else {
    console.log(`⊘ Registry query did not find Steam (this is OK if Steam is not installed)`);
    return true;
  }
}

async function testRegistryQueryInvalidKey() {
  console.log('\nTesting registry query with invalid key...');
  
  if (process.platform !== 'win32') {
    console.log('⊘ Skipped (not running on Windows)');
    return true;
  }
  
  const result = await queryWindowsRegistry(
    'HKLM\\SOFTWARE\\NonExistent\\Invalid',
    'InvalidValue'
  );
  
  console.log('Result:', result);
  
  if (!result.success) {
    console.log('✓ Registry query correctly returns error for invalid key');
    return true;
  } else {
    console.error('✗ Registry query should fail for invalid key');
    return false;
  }
}

async function runTests() {
  console.log('=== Registry Reader Tests ===\n');
  
  const results = await Promise.all([
    testRegistryQueryNonWindows(),
    testRegistryQueryWindows(),
    testRegistryQueryInvalidKey()
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
