const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const { SettingsStore, DEFAULT_SETTINGS } = require('../main/settings-store');

function createMockApp() {
  return {
    getPath: (name) => {
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'test-electron-app-' + Date.now());
      }
      return os.tmpdir();
    }
  };
}

function testDefaultSettings() {
  console.log('Testing default settings...');
  
  const mockApp = createMockApp();
  const store = new SettingsStore(mockApp);
  const settings = store.get();
  
  if (settings.theme === 'dark' &&
      settings.appId === '' &&
      settings.includeDlc === true &&
      settings.outputFolder === '') {
    console.log('✓ Default settings are correct');
    return true;
  } else {
    console.error('✗ Default settings are incorrect:', settings);
    return false;
  }
}

async function testLoadNonExistentFile() {
  console.log('\nTesting load of non-existent settings file...');
  
  const mockApp = createMockApp();
  const store = new SettingsStore(mockApp);
  const result = await store.load();
  
  if (result.success && result.settings.theme === 'dark') {
    console.log('✓ Non-existent file loads defaults correctly');
    return true;
  } else {
    console.error('✗ Failed to load defaults for non-existent file:', result);
    return false;
  }
}

async function testSaveAndLoad() {
  console.log('\nTesting save and load cycle...');
  
  let tempDir;
  const mockApp = {
    getPath: (name) => {
      if (name === 'userData') {
        if (!tempDir) {
          tempDir = path.join(os.tmpdir(), 'test-electron-app-' + Date.now());
        }
        return tempDir;
      }
      return os.tmpdir();
    }
  };
  
  const store = new SettingsStore(mockApp);
  
  const testSettings = {
    theme: 'light',
    appId: '730',
    includeDlc: false,
    outputFolder: '/test/path'
  };
  
  const saveResult = await store.save(testSettings);
  if (!saveResult.success) {
    console.error('✗ Failed to save settings:', saveResult);
    return false;
  }
  
  const newStore = new SettingsStore(mockApp);
  const loadResult = await newStore.load();
  
  if (!loadResult.success) {
    console.error('✗ Failed to load settings:', loadResult);
    return false;
  }
  
  const loaded = loadResult.settings;
  if (loaded.theme === 'light' &&
      loaded.appId === '730' &&
      loaded.includeDlc === false &&
      loaded.outputFolder === '/test/path') {
    console.log('✓ Settings saved and loaded correctly');
    
    try {
      const filePath = store.getSettingsPath();
      await fs.unlink(filePath);
      const dir = path.dirname(filePath);
      await fs.rmdir(dir);
    } catch (error) {
      console.warn('Warning: Could not clean up test files:', error.message);
    }
    
    return true;
  } else {
    console.error('✗ Loaded settings do not match saved settings:', loaded);
    return false;
  }
}

async function testPartialUpdate() {
  console.log('\nTesting partial settings update...');
  
  const mockApp = createMockApp();
  const store = new SettingsStore(mockApp);
  
  await store.save({ appId: '440', theme: 'dark' });
  
  await store.save({ appId: '730' });
  
  const settings = store.get();
  
  if (settings.appId === '730' && settings.theme === 'dark' && settings.includeDlc === true) {
    console.log('✓ Partial update preserves other settings');
    
    try {
      const filePath = store.getSettingsPath();
      await fs.unlink(filePath);
      const dir = path.dirname(filePath);
      await fs.rmdir(dir);
    } catch (error) {
      console.warn('Warning: Could not clean up test files:', error.message);
    }
    
    return true;
  } else {
    console.error('✗ Partial update failed:', settings);
    return false;
  }
}

async function testFileCorruption() {
  console.log('\nTesting handling of corrupted settings file...');
  
  let tempDir;
  const mockApp = {
    getPath: (name) => {
      if (name === 'userData') {
        if (!tempDir) {
          tempDir = path.join(os.tmpdir(), 'test-electron-app-' + Date.now());
        }
        return tempDir;
      }
      return os.tmpdir();
    }
  };
  
  const store = new SettingsStore(mockApp);
  
  await store.save({ appId: '730' });
  
  const filePath = store.getSettingsPath();
  await fs.writeFile(filePath, 'invalid json {{{', 'utf8');
  
  const newStore = new SettingsStore(mockApp);
  const result = await newStore.load();
  
  if (!result.success && result.settings.theme === 'dark') {
    console.log('✓ Corrupted file falls back to defaults');
    
    try {
      await fs.unlink(filePath);
      const dir = path.dirname(filePath);
      await fs.rmdir(dir);
    } catch (error) {
      console.warn('Warning: Could not clean up test files:', error.message);
    }
    
    return true;
  } else {
    console.error('✗ Corrupted file not handled correctly:', result);
    return false;
  }
}

async function testReset() {
  console.log('\nTesting settings reset...');
  
  const mockApp = createMockApp();
  const store = new SettingsStore(mockApp);
  
  await store.save({ theme: 'light', appId: '730' });
  
  const resetSettings = store.reset();
  
  if (resetSettings.theme === 'dark' && resetSettings.appId === '') {
    console.log('✓ Settings reset correctly');
    
    try {
      const filePath = store.getSettingsPath();
      await fs.unlink(filePath);
      const dir = path.dirname(filePath);
      await fs.rmdir(dir);
    } catch (error) {
      console.warn('Warning: Could not clean up test files:', error.message);
    }
    
    return true;
  } else {
    console.error('✗ Reset failed:', resetSettings);
    return false;
  }
}

async function runTests() {
  console.log('=== Settings Store Tests ===\n');
  
  const results = [
    testDefaultSettings(),
    await testLoadNonExistentFile(),
    await testSaveAndLoad(),
    await testPartialUpdate(),
    await testFileCorruption(),
    await testReset()
  ];
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n=== Results: ${passed}/${total} tests passed ===`);
  
  return passed === total;
}

if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
