const fs = require('fs').promises;
const path = require('path');
const { parseVDFFile } = require('../parsers/vdf-parser');

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
    const depots = data?.InstallConfigStore?.Software?.Valve?.Steam?.depots;
    
    if (depots && typeof depots === 'object') {
      for (const [depotId, depotData] of Object.entries(depots)) {
        if (/^\d+$/.test(depotId) && typeof depotData === 'object') {
          const decryptionKey = depotData.DecryptionKey || depotData.decryptionkey;
          if (decryptionKey && typeof decryptionKey === 'string') {
            const hexKey = decryptionKey.trim();
            if (/^[0-9A-Fa-f]+$/.test(hexKey)) {
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
  
  if (!steamRoot) {
    const defaultPath = path.join('C:', 'Program Files (x86)', 'Steam');
    try {
      await fs.access(defaultPath);
      steamRoot = defaultPath;
    } catch (error) {
      errors.push(`Default Steam path not found: ${defaultPath}`);
    }
  }
  
  if (!steamRoot) {
    return { success: false, steamRoot: null, errors };
  }
  
  return { success: true, steamRoot, errors };
}

module.exports = {
  parseDepotKeys,
  resolveSteamRoot
};
