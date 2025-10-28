const fs = require('fs').promises;
const path = require('path');
const { parseVDFFile } = require('../parsers/vdf-parser');
const { discoverLibraryFolders } = require('./library-discovery');
const { parseDepotKeys, resolveSteamRoot } = require('./config-reader');

async function findAppManifest(appId, libraries) {
  for (const library of libraries) {
    const manifestPath = path.join(library, 'steamapps', `appmanifest_${appId}.acf`);
    try {
      await fs.access(manifestPath);
      return manifestPath;
    } catch (error) {
    }
  }
  return null;
}

function extractInstalledDepots(appState) {
  const depots = [];
  
  if (!appState || !appState.InstalledDepots) {
    return depots;
  }
  
  const installedDepotsBlock = appState.InstalledDepots;
  
  for (const [key, value] of Object.entries(installedDepotsBlock)) {
    if (/^\d+$/.test(key)) {
      const depotId = key;
      let manifestId = '';
      
      if (typeof value === 'object' && value.manifest) {
        manifestId = value.manifest;
      } else if (typeof value === 'string') {
        manifestId = value;
      }
      
      depots.push({
        depotId,
        manifestId
      });
    }
  }
  
  return depots;
}

function classifyDepot(depotId, appId) {
  const depotIdNum = parseInt(depotId, 10);
  const appIdNum = parseInt(appId, 10);
  
  if (isNaN(depotIdNum) || isNaN(appIdNum)) {
    return 'unknown';
  }
  
  if (depotIdNum > appIdNum + 100000) {
    return 'dlc';
  }
  
  return 'main';
}

async function loadAppData(options = {}) {
  const { appId, includeDlc = true, steamPathOverride = null } = options;
  
  const result = {
    success: false,
    appId,
    appName: '',
    depots: [],
    missingKeys: [],
    errors: [],
    warnings: []
  };
  
  if (!appId || !/^\d+$/.test(appId)) {
    result.errors.push('Invalid app ID provided');
    return result;
  }
  
  const steamRootResult = await resolveSteamRoot(steamPathOverride);
  if (!steamRootResult.success) {
    result.errors.push(...steamRootResult.errors);
    return result;
  }
  
  const steamRoot = steamRootResult.steamRoot;
  result.warnings.push(...steamRootResult.errors);
  
  const librariesResult = await discoverLibraryFolders(steamPathOverride);
  if (!librariesResult.success || librariesResult.libraries.length === 0) {
    result.errors.push('No Steam libraries found');
    result.errors.push(...librariesResult.errors);
    return result;
  }
  
  result.warnings.push(...librariesResult.errors);
  
  const manifestPath = await findAppManifest(appId, librariesResult.libraries);
  if (!manifestPath) {
    result.errors.push(`App manifest not found for app ID ${appId}`);
    return result;
  }
  
  const vdfResult = await parseVDFFile(manifestPath);
  if (!vdfResult.success) {
    result.errors.push(`Failed to parse app manifest: ${vdfResult.error}`);
    return result;
  }
  
  const appState = vdfResult.data.AppState;
  if (!appState) {
    result.errors.push('Invalid app manifest structure');
    return result;
  }
  
  result.appName = appState.name || appState.Name || '';
  
  const installedDepots = extractInstalledDepots(appState);
  
  const configVdfPath = path.join(steamRoot, 'config', 'config.vdf');
  console.log('[DEBUG] loadAppData - Config VDF path:', configVdfPath);
  
  const depotKeysResult = await parseDepotKeys(configVdfPath);
  result.warnings.push(...depotKeysResult.errors);
  const depotKeys = depotKeysResult.depotKeys;
  
  console.log('[DEBUG] loadAppData - Depot keys received from parseDepotKeys:', Object.keys(depotKeys));
  console.log('[DEBUG] loadAppData - Total keys available:', Object.keys(depotKeys).length);
  
  for (const depot of installedDepots) {
    const depotType = classifyDepot(depot.depotId, appId);
    
    if (!includeDlc && depotType === 'dlc') {
      console.log('[DEBUG] loadAppData - Skipping DLC depot:', depot.depotId);
      continue;
    }
    
    console.log('[DEBUG] loadAppData - Looking up key for depot:', depot.depotId);
    const decryptionKey = depotKeys[depot.depotId] || '';
    
    if (!decryptionKey) {
      console.log('[DEBUG] loadAppData - NO KEY FOUND for depot:', depot.depotId);
      console.log('[DEBUG] loadAppData - Available depot IDs in map:', Object.keys(depotKeys));
      result.missingKeys.push(depot.depotId);
      result.warnings.push(`No decryption key found for depot ${depot.depotId}`);
    } else {
      console.log('[DEBUG] loadAppData - Key found for depot', depot.depotId, ':', decryptionKey.substring(0, 16) + '...');
    }
    
    result.depots.push({
      depotId: depot.depotId,
      manifestId: depot.manifestId,
      type: depotType,
      decryptionKey
    });
  }
  
  result.success = true;
  return result;
}

module.exports = {
  loadAppData,
  findAppManifest,
  extractInstalledDepots,
  classifyDepot
};
