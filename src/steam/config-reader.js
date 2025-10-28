const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { parseVDFFile } = require('../parsers/vdf-parser');
const { getSteamInstallPathFromRegistry } = require('./registry-reader');

async function parseDepotKeys(configVdfPath) {
  const depotKeys = {};
  const errors = [];
  
  try {
    await fs.access(configVdfPath);
  } catch (error) {
    errors.push(`Config file not found: ${configVdfPath}`);
    return { depotKeys, errors };
  }
  
  const vdfResult = await parseVDFFile(configVdfPath);
  if (!vdfResult.success) {
    errors.push(`Failed to parse config.vdf: ${vdfResult.error}`);
    return { depotKeys, errors };
  }
  
  try {
    const data = vdfResult.data;
    
    // Try multiple possible paths to find the depots object
    // Some config.vdf files might have slightly different structures
    let depots = null;
    
    // Standard path
    depots = data?.InstallConfigStore?.Software?.Valve?.Steam?.depots;
    
    // Alternative paths (for different Steam versions or configurations)
    if (!depots) {
      depots = data?.Software?.Valve?.Steam?.depots;
    }
    if (!depots) {
      depots = data?.Steam?.depots;
    }
    if (!depots) {
      depots = data?.depots;
    }
    
    if (depots && typeof depots === 'object') {
      for (const [depotId, depotData] of Object.entries(depots)) {
        // Only process numeric depot IDs
        if (/^\d+$/.test(depotId) && typeof depotData === 'object') {
          // Try both capitalized and lowercase variations
          const decryptionKey = depotData.DecryptionKey || 
                               depotData.decryptionkey || 
                               depotData.decryptionKey ||
                               depotData.DECRYPTIONKEY;
          
          if (decryptionKey && typeof decryptionKey === 'string') {
            const hexKey = decryptionKey.trim();
            // Validate that it's a valid hex string
            if (/^[0-9A-Fa-f]+$/.test(hexKey) && hexKey.length > 0) {
              depotKeys[depotId] = hexKey;
            }
          }
        }
      }
    }
  } catch (error) {
    errors.push(`Error extracting depot keys: ${error.message}`);
  }
  
  return { depotKeys, errors };
}

function getDefaultSteamPaths() {
  const platform = process.platform;
  
  switch (platform) {
    case 'win32':
      return [
        path.join('C:', 'Program Files (x86)', 'Steam'),
        path.join('C:', 'Program Files', 'Steam')
      ];
    case 'darwin':
      return [path.join(os.homedir(), 'Library', 'Application Support', 'Steam')];
    case 'linux':
      return [
        path.join(os.homedir(), '.steam', 'steam'),
        path.join(os.homedir(), '.local', 'share', 'Steam')
      ];
    default:
      return [];
  }
}

async function resolveSteamRoot(steamPathOverride = null) {
  const errors = [];
  let steamRoot = null;
  
  if (steamPathOverride) {
    try {
      await fs.access(steamPathOverride);
      steamRoot = steamPathOverride;
    } catch (error) {
      errors.push(`Provided Steam path not accessible: ${steamPathOverride}`);
    }
  }
  
  if (!steamRoot && process.platform === 'win32') {
    const registryResult = await getSteamInstallPathFromRegistry();
    if (registryResult.success && registryResult.path) {
      try {
        await fs.access(registryResult.path);
        steamRoot = registryResult.path;
      } catch (error) {
        errors.push(`Registry Steam path not accessible: ${registryResult.path}`);
      }
    } else {
      errors.push(`Registry lookup failed: ${registryResult.error}`);
    }
  }
  
  if (!steamRoot) {
    const defaultPaths = getDefaultSteamPaths();
    for (const defaultPath of defaultPaths) {
      try {
        await fs.access(defaultPath);
        steamRoot = defaultPath;
        break;
      } catch (error) {
        errors.push(`Steam path not found: ${defaultPath}`);
      }
    }
  }
  
  if (!steamRoot) {
    return { success: false, steamRoot: null, errors };
  }
  
  return { success: true, steamRoot, errors };
}

module.exports = {
  parseDepotKeys,
  resolveSteamRoot,
  getDefaultSteamPaths
};
