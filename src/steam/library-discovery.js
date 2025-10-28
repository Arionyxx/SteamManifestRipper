const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { parseVDFFile } = require('../parsers/vdf-parser');

function getDefaultSteamPath() {
  const platform = process.platform;
  
  switch (platform) {
    case 'win32':
      return path.join('C:', 'Program Files (x86)', 'Steam');
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Steam');
    case 'linux':
      return path.join(os.homedir(), '.steam', 'steam');
    default:
      return null;
  }
}

function getLibraryFoldersVDFPath(steamPath) {
  return path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
}

async function discoverLibraryFolders() {
  const errors = [];
  const libraries = [];
  
  const defaultSteamPath = getDefaultSteamPath();
  if (!defaultSteamPath) {
    errors.push('Unsupported platform for Steam detection');
    return { success: false, libraries: [], errors };
  }
  
  try {
    await fs.access(defaultSteamPath);
  } catch (error) {
    errors.push(`Steam installation not found at default path: ${defaultSteamPath}`);
    return { success: false, libraries: [], errors };
  }
  
  libraries.push(defaultSteamPath);
  
  const libraryFoldersPath = getLibraryFoldersVDFPath(defaultSteamPath);
  
  try {
    await fs.access(libraryFoldersPath);
  } catch (error) {
    errors.push(`libraryfolders.vdf not found at: ${libraryFoldersPath}`);
    return { success: true, libraries, errors };
  }
  
  const vdfResult = await parseVDFFile(libraryFoldersPath);
  if (!vdfResult.success) {
    errors.push(`Failed to parse libraryfolders.vdf: ${vdfResult.error}`);
    return { success: true, libraries, errors };
  }
  
  const libraryFolders = vdfResult.data.libraryfolders || vdfResult.data.LibraryFolders;
  
  if (libraryFolders) {
    for (const [key, value] of Object.entries(libraryFolders)) {
      if (/^\d+$/.test(key) && typeof value === 'object') {
        const libraryPath = value.path || value.Path;
        if (libraryPath) {
          try {
            await fs.access(libraryPath);
            if (!libraries.includes(libraryPath)) {
              libraries.push(libraryPath);
            }
          } catch (error) {
            errors.push(`Library path not accessible: ${libraryPath}`);
          }
        }
      }
    }
  }
  
  return { success: true, libraries, errors };
}

async function getDepotCachePath(libraryPath) {
  return path.join(libraryPath, 'steamapps', 'depotcache');
}

async function getSteamAppsPath(libraryPath) {
  return path.join(libraryPath, 'steamapps');
}

module.exports = {
  getDefaultSteamPath,
  getLibraryFoldersVDFPath,
  discoverLibraryFolders,
  getDepotCachePath,
  getSteamAppsPath
};
