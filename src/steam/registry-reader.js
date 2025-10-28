const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function queryWindowsRegistry(keyPath, valueName) {
  if (process.platform !== 'win32') {
    return { success: false, value: null, error: 'Not running on Windows' };
  }

  try {
    const { stdout } = await execFileAsync('reg.exe', [
      'query',
      keyPath,
      '/v',
      valueName
    ], { timeout: 5000 });

    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes(valueName)) {
        const parts = line.trim().split(/\s+/);
        const valueIndex = parts.indexOf(valueName);
        if (valueIndex !== -1 && parts.length > valueIndex + 2) {
          const value = parts.slice(valueIndex + 2).join(' ').trim();
          return { success: true, value, error: null };
        }
      }
    }

    return { success: false, value: null, error: 'Value not found in registry output' };
  } catch (error) {
    return { success: false, value: null, error: error.message };
  }
}

async function getSteamInstallPathFromRegistry() {
  const registryPaths = [
    'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam',
    'HKLM\\SOFTWARE\\Valve\\Steam'
  ];

  for (const registryPath of registryPaths) {
    const result = await queryWindowsRegistry(registryPath, 'InstallPath');
    if (result.success && result.value) {
      return { success: true, path: result.value, error: null };
    }
  }

  return { success: false, path: null, error: 'Steam not found in registry' };
}

module.exports = {
  queryWindowsRegistry,
  getSteamInstallPathFromRegistry
};
