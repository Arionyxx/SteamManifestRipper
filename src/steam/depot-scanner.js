const fs = require('fs').promises;
const path = require('path');
const { parseVDFFile, extractDepotIds, extractDLCIds } = require('../parsers/vdf-parser');
const { parseDepotKeys, resolveSteamRoot } = require('./config-reader');

async function findManifestFiles(depotCachePath) {
  const manifestFiles = [];
  
  try {
    await fs.access(depotCachePath);
    const files = await fs.readdir(depotCachePath);
    
    for (const file of files) {
      if (file.endsWith('.manifest')) {
        const fullPath = path.join(depotCachePath, file);
        manifestFiles.push({
          path: fullPath,
          filename: file
        });
      }
    }
  } catch (error) {
  }
  
  return manifestFiles;
}

function extractManifestId(filename) {
  const tokens = filename.match(/\d{10,22}/g);
  if (!tokens || tokens.length === 0) {
    return '';
  }
  
  const longest = tokens.reduce((a, b) => a.length >= b.length ? a : b);
  return longest;
}

function extractDepotId(filename) {
  const match = filename.match(/^(\d+)_/);
  if (match) {
    return match[1];
  }
  
  const altMatch = filename.match(/depot[_-]?(\d+)/i);
  if (altMatch) {
    return altMatch[1];
  }
  
  return '';
}

async function buildAppDepotMap(steamRoot) {
  const appDepotMap = {};
  const depotAppMap = {};
  const dlcApps = new Set();
  const errors = [];
  
  const steamappsPath = path.join(steamRoot, 'steamapps');
  
  try {
    const files = await fs.readdir(steamappsPath);
    
    for (const file of files) {
      if (file.startsWith('appmanifest_') && file.endsWith('.acf')) {
        const appIdMatch = file.match(/appmanifest_(\d+)\.acf/);
        if (!appIdMatch) continue;
        
        const appId = appIdMatch[1];
        const manifestPath = path.join(steamappsPath, file);
        
        try {
          const result = await parseVDFFile(manifestPath);
          if (!result.success) {
            errors.push(`Failed to parse ${file}: ${result.error}`);
            continue;
          }
          
          const appState = result.data.AppState;
          if (!appState) continue;
          
          const depotIds = extractDepotIds(appState);
          const dlcIds = extractDLCIds(appState);
          
          appDepotMap[appId] = {
            depots: depotIds,
            dlc: dlcIds,
            name: appState.name || appState.Name || ''
          };
          
          depotIds.forEach(depotId => {
            depotAppMap[depotId] = appId;
          });
          
          dlcIds.forEach(dlcId => {
            dlcApps.add(dlcId);
          });
          
        } catch (error) {
          errors.push(`Error processing ${file}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    errors.push(`Error reading steamapps directory: ${error.message}`);
  }
  
  return { appDepotMap, depotAppMap, dlcApps: Array.from(dlcApps), errors };
}

function determineRowType(depotId, appId, depotAppMap, dlcApps) {
  if (!appId || appId === '') {
    return 'orphan';
  }
  
  if (dlcApps.includes(appId)) {
    return 'dlc';
  }
  
  if (depotAppMap[depotId] === appId) {
    return 'base';
  }
  
  return 'orphan';
}

function determineRowStatus(row, depotAppMap) {
  const errors = [];
  
  if (!row.manifestId || !/^\d{10,22}$/.test(row.manifestId)) {
    errors.push('Invalid or missing Manifest ID');
  }
  
  if (!row.depotId || !/^\d+$/.test(row.depotId)) {
    errors.push('Invalid or missing Depot ID');
  }
  
  if (!row.appId || !/^\d+$/.test(row.appId)) {
    errors.push('Invalid or missing APPID');
  }
  
  if (row.depotId && !depotAppMap[row.depotId] && row.type === 'orphan') {
    errors.push('Depot not found in any appmanifest');
  }
  
  if (errors.length > 0) {
    return { status: 'invalid', errors };
  }
  
  return { status: 'valid', errors: [] };
}

async function scanDepotCache(options = {}) {
  const {
    defaultAppId = '',
    inferAppId = true,
    steamPathOverride = null
  } = options;
  
  const result = {
    success: false,
    files: [],
    steamRoot: null,
    errors: [],
    warnings: []
  };
  
  const steamRootResult = await resolveSteamRoot(steamPathOverride);
  if (!steamRootResult.success) {
    result.errors.push(...steamRootResult.errors);
    return result;
  }
  
  result.steamRoot = steamRootResult.steamRoot;
  result.errors.push(...steamRootResult.errors);
  
  const configVdfPath = path.join(result.steamRoot, 'config', 'config.vdf');
  const depotKeysResult = await parseDepotKeys(configVdfPath);
  result.errors.push(...depotKeysResult.errors);
  const depotKeys = depotKeysResult.depotKeys;
  
  const mapResult = await buildAppDepotMap(result.steamRoot);
  result.errors.push(...mapResult.errors);
  const globalDepotAppMap = mapResult.depotAppMap;
  const globalDlcApps = mapResult.dlcApps;
  
  const depotCachePaths = [
    path.join(result.steamRoot, 'depotcache'),
    path.join(result.steamRoot, 'config', 'depotcache')
  ];
  
  for (const depotCachePath of depotCachePaths) {
    const manifestFiles = await findManifestFiles(depotCachePath);
    
    for (const manifest of manifestFiles) {
      const manifestId = extractManifestId(manifest.filename);
      const depotId = extractDepotId(manifest.filename);
      
      let appId = '';
      
      if (inferAppId && depotId && globalDepotAppMap[depotId]) {
        appId = globalDepotAppMap[depotId];
      } else if (defaultAppId) {
        appId = defaultAppId;
      }
      
      const type = determineRowType(depotId, appId, globalDepotAppMap, globalDlcApps);
      
      const decryptionKey = depotId && depotKeys[depotId] ? depotKeys[depotId] : '';
      
      const row = {
        path: manifest.path,
        name: manifest.filename,
        manifestId,
        depotId,
        appId,
        decryptionKey,
        type,
        status: 'pending',
        errors: [],
        location: depotCachePath
      };
      
      if (depotId && !decryptionKey) {
        result.warnings.push(`No decryption key found for depot ${depotId} (manifest: ${manifest.filename})`);
      }
      
      const statusResult = determineRowStatus(row, globalDepotAppMap);
      row.status = statusResult.status;
      row.errors = statusResult.errors;
      
      result.files.push(row);
    }
  }
  
  result.success = true;
  return result;
}

async function parseManifestFile(filePath, options = {}) {
  const {
    defaultAppId = '',
    inferAppId = true,
    depotAppMap = {}
  } = options;
  
  const filename = path.basename(filePath);
  const manifestId = extractManifestId(filename);
  const depotId = extractDepotId(filename);
  
  let appId = '';
  
  if (inferAppId && depotId && depotAppMap[depotId]) {
    appId = depotAppMap[depotId];
  } else if (defaultAppId) {
    appId = defaultAppId;
  }
  
  const row = {
    path: filePath,
    name: filename,
    manifestId,
    depotId,
    appId,
    decryptionKey: '',
    type: 'unknown',
    status: 'pending',
    errors: [],
    location: path.dirname(filePath)
  };
  
  const statusResult = determineRowStatus(row, depotAppMap);
  row.status = statusResult.status;
  row.errors = statusResult.errors;
  
  return row;
}

module.exports = {
  scanDepotCache,
  parseManifestFile,
  extractManifestId,
  extractDepotId,
  buildAppDepotMap
};
