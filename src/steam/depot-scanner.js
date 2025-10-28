const fs = require('fs').promises;
const path = require('path');
const { discoverLibraryFolders, getDepotCachePath, getSteamAppsPath } = require('./library-discovery');
const { parseVDFFile, extractDepotIds, extractDLCIds } = require('../parsers/vdf-parser');

async function findManifestFiles(depotCachePath) {
  const manifestFiles = [];
  const errors = [];
  
  try {
    await fs.access(depotCachePath);
  } catch (error) {
    errors.push(`Depotcache directory not found: ${depotCachePath}`);
    return { manifestFiles, errors };
  }
  
  try {
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
    errors.push(`Error reading depotcache directory: ${error.message}`);
  }
  
  return { manifestFiles, errors };
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

async function buildAppDepotMap(libraryPath) {
  const appDepotMap = {};
  const depotAppMap = {};
  const dlcApps = new Set();
  const errors = [];
  
  const steamappsPath = await getSteamAppsPath(libraryPath);
  
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
    inferAppId = true
  } = options;
  
  const result = {
    success: false,
    files: [],
    libraries: [],
    errors: [],
    warnings: []
  };
  
  const libraryDiscovery = await discoverLibraryFolders();
  if (!libraryDiscovery.success) {
    result.errors.push(...libraryDiscovery.errors);
    return result;
  }
  
  result.libraries = libraryDiscovery.libraries;
  result.errors.push(...libraryDiscovery.errors);
  
  const globalDepotAppMap = {};
  const globalDlcApps = [];
  
  for (const library of libraryDiscovery.libraries) {
    const mapResult = await buildAppDepotMap(library);
    result.errors.push(...mapResult.errors);
    
    Object.assign(globalDepotAppMap, mapResult.depotAppMap);
    globalDlcApps.push(...mapResult.dlcApps);
  }
  
  for (const library of libraryDiscovery.libraries) {
    const depotCachePath = await getDepotCachePath(library);
    const manifestResult = await findManifestFiles(depotCachePath);
    
    result.errors.push(...manifestResult.errors);
    
    for (const manifest of manifestResult.manifestFiles) {
      const manifestId = extractManifestId(manifest.filename);
      const depotId = extractDepotId(manifest.filename);
      
      let appId = '';
      
      if (inferAppId && depotId && globalDepotAppMap[depotId]) {
        appId = globalDepotAppMap[depotId];
      } else if (defaultAppId) {
        appId = defaultAppId;
      }
      
      const type = determineRowType(depotId, appId, globalDepotAppMap, globalDlcApps);
      
      const row = {
        path: manifest.path,
        name: manifest.filename,
        manifestId,
        depotId,
        appId,
        type,
        status: 'pending',
        errors: [],
        library
      };
      
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
    type: 'unknown',
    status: 'pending',
    errors: [],
    library: path.dirname(path.dirname(filePath))
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
