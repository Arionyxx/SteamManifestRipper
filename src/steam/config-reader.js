const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { parseVDFFile } = require('../parsers/vdf-parser');
const { getSteamInstallPathFromRegistry } = require('./registry-reader');

async function parseDepotKeys(configVdfPath) {
  const depotKeys = {};
  const errors = [];
  
  console.log('[DEBUG] parseDepotKeys - Reading config.vdf from:', configVdfPath);
  
  try {
    await fs.access(configVdfPath);
    console.log('[DEBUG] parseDepotKeys - Config file exists and is accessible');
  } catch (error) {
    console.log('[DEBUG] parseDepotKeys - Config file not found or not accessible');
    errors.push(`Config file not found: ${configVdfPath}`);
    return { depotKeys, errors };
  }
  
  // Read and log raw file content
  let rawContent = '';
  try {
    rawContent = await fs.readFile(configVdfPath, 'utf8');
    console.log('[DEBUG] parseDepotKeys - File size:', rawContent.length, 'bytes');
    console.log('[DEBUG] parseDepotKeys - First 500 chars:', rawContent.substring(0, 500));
  } catch (error) {
    console.log('[DEBUG] parseDepotKeys - Failed to read raw content:', error.message);
    errors.push(`Failed to read config.vdf: ${error.message}`);
    return { depotKeys, errors };
  }
  
  const vdfResult = await parseVDFFile(configVdfPath);
  if (!vdfResult.success) {
    console.log('[DEBUG] parseDepotKeys - VDF parsing failed:', vdfResult.error);
    errors.push(`Failed to parse config.vdf: ${vdfResult.error}`);
    return { depotKeys, errors };
  }
  
  console.log('[DEBUG] parseDepotKeys - VDF parsing succeeded');
  
  try {
    const data = vdfResult.data;
    console.log('[DEBUG] parseDepotKeys - Root keys in parsed data:', Object.keys(data));
    
    // Try multiple possible paths to find the depots object
    // Some config.vdf files might have slightly different structures
    let depots = null;
    let depotsPath = '';
    
    // Standard path
    depots = data?.InstallConfigStore?.Software?.Valve?.Steam?.depots;
    if (depots) {
      depotsPath = 'InstallConfigStore.Software.Valve.Steam.depots';
    }
    
    // Alternative paths (for different Steam versions or configurations)
    if (!depots) {
      depots = data?.Software?.Valve?.Steam?.depots;
      if (depots) depotsPath = 'Software.Valve.Steam.depots';
    }
    if (!depots) {
      depots = data?.Steam?.depots;
      if (depots) depotsPath = 'Steam.depots';
    }
    if (!depots) {
      depots = data?.depots;
      if (depots) depotsPath = 'depots';
    }
    
    if (depots && typeof depots === 'object') {
      console.log('[DEBUG] parseDepotKeys - Found depots object at path:', depotsPath);
      console.log('[DEBUG] parseDepotKeys - Depot entries found:', Object.keys(depots).length);
      console.log('[DEBUG] parseDepotKeys - Depot IDs:', Object.keys(depots).filter(k => /^\d+$/.test(k)));
      
      let count = 0;
      for (const [depotId, depotData] of Object.entries(depots)) {
        // Only process numeric depot IDs
        if (/^\d+$/.test(depotId) && typeof depotData === 'object') {
          console.log('[DEBUG] parseDepotKeys - Processing depot:', depotId);
          console.log('[DEBUG] parseDepotKeys - Depot data keys:', Object.keys(depotData));
          
          // Try both capitalized and lowercase variations
          const decryptionKey = depotData.DecryptionKey || 
                               depotData.decryptionkey || 
                               depotData.decryptionKey ||
                               depotData.DECRYPTIONKEY;
          
          if (decryptionKey && typeof decryptionKey === 'string') {
            const hexKey = decryptionKey.trim();
            console.log('[DEBUG] parseDepotKeys - Found DecryptionKey for depot', depotId, ':', hexKey.substring(0, 16) + '...');
            
            // Validate that it's a valid hex string
            if (/^[0-9A-Fa-f]+$/.test(hexKey) && hexKey.length > 0) {
              depotKeys[depotId] = hexKey;
              count++;
              console.log('[DEBUG] parseDepotKeys - Validated and stored key for depot', depotId);
            } else {
              console.log('[DEBUG] parseDepotKeys - Invalid hex key for depot', depotId, '- rejected');
            }
          } else {
            console.log('[DEBUG] parseDepotKeys - No DecryptionKey found for depot', depotId);
          }
        }
      }
      
      console.log('[DEBUG] parseDepotKeys - Total depot keys extracted:', count);
    } else {
      console.log('[DEBUG] parseDepotKeys - No depots object found in any known path');
      console.log('[DEBUG] parseDepotKeys - Available paths checked:');
      console.log('  - InstallConfigStore.Software.Valve.Steam.depots');
      console.log('  - Software.Valve.Steam.depots');
      console.log('  - Steam.depots');
      console.log('  - depots');
    }
    
    console.log('[DEBUG] parseDepotKeys - Final depot key map:', Object.keys(depotKeys));
    console.log('[DEBUG] parseDepotKeys - Total keys in map:', Object.keys(depotKeys).length);
  } catch (error) {
    console.log('[DEBUG] parseDepotKeys - Error during extraction:', error.message);
    console.log('[DEBUG] parseDepotKeys - Error stack:', error.stack);
    errors.push(`Error extracting depot keys: ${error.message}`);
  }
  
  // Fallback: If no keys were found using the VDF parser, try regex-based extraction
  if (Object.keys(depotKeys).length === 0 && rawContent) {
    console.log('[DEBUG] parseDepotKeys - No keys found with VDF parser, trying regex fallback...');
    
    try {
      // Regex approach: Match "depotID" { ... "DecryptionKey" "hexkey" ... }
      // This handles the exact format with flexible whitespace
      const regexPattern = /"(\d+)"\s*\{\s*"DecryptionKey"\s+"([0-9a-fA-F]{32,64})"\s*\}/g;
      
      let match;
      let regexCount = 0;
      while ((match = regexPattern.exec(rawContent)) !== null) {
        const depotId = match[1];
        const key = match[2];
        
        if (/^[0-9A-Fa-f]+$/.test(key) && key.length > 0) {
          depotKeys[depotId] = key;
          regexCount++;
          console.log('[DEBUG] parseDepotKeys - Regex found key for depot:', depotId, '-> ', key.substring(0, 16) + '...');
        }
      }
      
      if (regexCount > 0) {
        console.log('[DEBUG] parseDepotKeys - Regex fallback succeeded! Found', regexCount, 'depot keys');
      } else {
        console.log('[DEBUG] parseDepotKeys - Regex fallback also found no keys, trying line-by-line parsing...');
        
        // Line-by-line fallback for even more robustness
        const lines = rawContent.split(/\r?\n/);
        let currentDepotId = null;
        let insideDepotBlock = false;
        let braceDepth = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Check for depot ID line (numeric ID in quotes)
          const depotIdMatch = line.match(/^"(\d+)"$/);
          if (depotIdMatch) {
            currentDepotId = depotIdMatch[1];
            console.log('[DEBUG] parseDepotKeys - Line parser found potential depot ID:', currentDepotId);
            continue;
          }
          
          // Track braces
          if (line === '{') {
            braceDepth++;
            if (currentDepotId && braceDepth === 1) {
              insideDepotBlock = true;
            }
          } else if (line === '}') {
            braceDepth--;
            if (braceDepth === 0) {
              insideDepotBlock = false;
              currentDepotId = null;
            }
          }
          
          // Look for DecryptionKey when inside a depot block
          if (insideDepotBlock && currentDepotId) {
            const keyMatch = line.match(/^"DecryptionKey"\s+"([0-9a-fA-F]{32,64})"$/);
            if (keyMatch) {
              const key = keyMatch[1];
              if (/^[0-9A-Fa-f]+$/.test(key) && key.length > 0) {
                depotKeys[currentDepotId] = key;
                console.log('[DEBUG] parseDepotKeys - Line parser found key for depot:', currentDepotId, '-> ', key.substring(0, 16) + '...');
              }
            }
          }
        }
        
        console.log('[DEBUG] parseDepotKeys - Line-by-line parser finished, total keys:', Object.keys(depotKeys).length);
      }
    } catch (fallbackError) {
      console.log('[DEBUG] parseDepotKeys - Fallback parsing failed:', fallbackError.message);
      errors.push(`Fallback parsing also failed: ${fallbackError.message}`);
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
