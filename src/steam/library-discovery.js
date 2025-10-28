const fs = require('fs').promises;
const path = require('path');
const { parseVDFFile } = require('../parsers/vdf-parser');
const { resolveSteamRoot } = require('./config-reader');

function getLibraryFoldersVDFPath(steamPath) {
  return path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
}

async function discoverLibraryFolders(steamPathOverride = null) {
  const errors = [];
  const libraries = [];
  
  const steamRootResult = await resolveSteamRoot(steamPathOverride);
  if (!steamRootResult.success) {
    errors.push(...steamRootResult.errors);
    return { success: false, libraries: [], errors };
  }
  
  const steamRoot = steamRootResult.steamRoot;
  errors.push(...steamRootResult.errors);
  
  libraries.push(steamRoot);
  
  const libraryFoldersPath = getLibraryFoldersVDFPath(steamRoot);
  
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
  getLibraryFoldersVDFPath,
  discoverLibraryFolders,
  getDepotCachePath,
  getSteamAppsPath
};
