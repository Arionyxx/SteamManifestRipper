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
  
  // Read raw file content for fallback parsing
  let rawContent = '';
  try {
    rawContent = await fs.readFile(configVdfPath, 'utf8');
  } catch (error) {
    errors.push(`Failed to read config.vdf: ${error.message}`);
    return { depotKeys, errors };
  }
  
  // Try VDF parser first
  const vdfResult = await parseVDFFile(configVdfPath);
  if (vdfResult.success) {
    try {
      const data = vdfResult.data;
      
      // Try multiple possible paths to find the depots object
      let depots = null;
      
      depots = data?.InstallConfigStore?.Software?.Valve?.Steam?.depots ||
               data?.Software?.Valve?.Steam?.depots ||
               data?.Steam?.depots ||
               data?.depots;
      
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
              
              // Validate hex string
              if (/^[0-9A-Fa-f]{32,64}$/.test(hexKey)) {
                depotKeys[depotId] = hexKey;
              }
            }
          }
        }
      }
    } catch (error) {
      errors.push(`Error extracting depot keys: ${error.message}`);
    }
  }
  
  // Fallback: Regex-based extraction if VDF parser failed or found no keys
  if (Object.keys(depotKeys).length === 0 && rawContent) {
    try {
      // Method 1: Direct pattern matching for depot blocks
      const regexPattern = /"(\d+)"\s*\{\s*"DecryptionKey"\s+"([0-9a-fA-F]{32,64})"\s*\}/gi;
      let match;
      
      while ((match = regexPattern.exec(rawContent)) !== null) {
        const depotId = match[1];
        const key = match[2];
        
        if (/^[0-9A-Fa-f]{32,64}$/.test(key)) {
          depotKeys[depotId] = key;
        }
      }
      
      // Method 2: Line-by-line parsing for complex structures
      if (Object.keys(depotKeys).length === 0) {
        const lines = rawContent.split(/\r?\n/);
        let currentDepotId = null;
        let insideDepotBlock = false;
        let braceDepth = 0;
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          // Check for depot ID line
          const depotIdMatch = trimmed.match(/^"(\d+)"\s*$/);
          if (depotIdMatch) {
            currentDepotId = depotIdMatch[1];
            continue;
          }
          
          // Track braces
          if (trimmed === '{') {
            braceDepth++;
            if (currentDepotId && braceDepth === 1) {
              insideDepotBlock = true;
            }
          } else if (trimmed === '}') {
            braceDepth--;
            if (braceDepth === 0) {
              insideDepotBlock = false;
              currentDepotId = null;
            }
          }
          
          // Look for DecryptionKey when inside depot block
          if (insideDepotBlock && currentDepotId) {
            const keyMatch = trimmed.match(/^"DecryptionKey"\s+"([0-9a-fA-F]{32,64})"\s*$/i);
            if (keyMatch) {
              const key = keyMatch[1];
              if (/^[0-9A-Fa-f]{32,64}$/.test(key)) {
                depotKeys[currentDepotId] = key;
              }
            }
          }
        }
      }
    } catch (fallbackError) {
      errors.push(`Fallback parsing failed: ${fallbackError.message}`);
    }
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
  
  // Try override path first
  if (steamPathOverride) {
    try {
      await fs.access(steamPathOverride);
      steamRoot = steamPathOverride;
      return { success: true, steamRoot, errors };
    } catch (error) {
      errors.push(`Provided Steam path not accessible: ${steamPathOverride}`);
    }
  }
  
  // Try Windows registry
  if (!steamRoot && process.platform === 'win32') {
    const registryResult = await getSteamInstallPathFromRegistry();
    if (registryResult.success && registryResult.path) {
      try {
        await fs.access(registryResult.path);
        steamRoot = registryResult.path;
        return { success: true, steamRoot, errors };
      } catch (error) {
        errors.push(`Registry Steam path not accessible: ${registryResult.path}`);
      }
    } else if (registryResult.error) {
      errors.push(`Registry lookup failed: ${registryResult.error}`);
    }
  }
  
  // Try default paths
  if (!steamRoot) {
    const defaultPaths = getDefaultSteamPaths();
    for (const defaultPath of defaultPaths) {
      try {
        await fs.access(defaultPath);
        steamRoot = defaultPath;
        return { success: true, steamRoot, errors };
      } catch (error) {
        // Continue to next path
      }
    }
    
    if (defaultPaths.length > 0) {
      errors.push(`No Steam installation found in default locations`);
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
