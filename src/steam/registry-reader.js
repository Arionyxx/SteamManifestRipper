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

    // Parse registry output
    // Format: "    InstallPath    REG_SZ    C:\Program Files (x86)\Steam"
    const match = stdout.match(new RegExp(`${valueName}\\s+REG_\\w+\\s+(.+)`, 'i'));
    
    if (match && match[1]) {
      const value = match[1].trim();
      return { success: true, value, error: null };
    }

    return { success: false, value: null, error: 'Value not found in registry output' };
  } catch (error) {
    return { success: false, value: null, error: error.message };
  }
}

async function getSteamInstallPathFromRegistry() {
  const registryPaths = [
    'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam',  // 64-bit Windows, 32-bit app
    'HKLM\\SOFTWARE\\Valve\\Steam',                // 32-bit Windows or 64-bit app
    'HKCU\\SOFTWARE\\Valve\\Steam'                 // Per-user installation (fallback)
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
