const fs = require('fs').promises;
const path = require('path');
const { discoverLibraryFolders } = require('./library-discovery');

async function findManifestFile(depotId, manifestId, libraries) {
  const manifestFilename = `${depotId}_${manifestId}.manifest`;
  
  for (const library of libraries) {
    const depotcachePath = path.join(library, 'depotcache');
    const manifestPath = path.join(depotcachePath, manifestFilename);
    
    try {
      await fs.access(manifestPath);
      return manifestPath;
    } catch (error) {
      // Continue searching in other libraries
    }
  }
  
  return null;
}

async function ensureDestinationExists(destination) {
  try {
    await fs.access(destination);
  } catch (error) {
    // Try to create the directory if it doesn't exist
    try {
      await fs.mkdir(destination, { recursive: true });
    } catch (mkdirError) {
      throw new Error(`Cannot create destination directory: ${destination}`);
    }
  }
}

async function copyManifests(options = {}) {
  const { 
    depots = [], 
    destination = './output', 
    steamPathOverride = null,
    organizeByAppId = true 
  } = options;
  
  const result = {
    success: false,
    copied: [],
    missing: [],
    errors: []
  };
  
  if (!destination) {
    result.errors.push('No destination directory specified');
    return result;
  }
  
  // Ensure base destination exists
  try {
    await ensureDestinationExists(destination);
  } catch (error) {
    result.errors.push(error.message);
    return result;
  }
  
  if (!Array.isArray(depots) || depots.length === 0) {
    result.errors.push('No depots provided');
    return result;
  }
  
  const librariesResult = await discoverLibraryFolders(steamPathOverride);
  if (!librariesResult.success || librariesResult.libraries.length === 0) {
    result.errors.push('No Steam libraries found');
    result.errors.push(...librariesResult.errors);
    return result;
  }
  
  // Process each depot
  for (const depot of depots) {
    if (!depot.depotId || !depot.manifestId) {
      result.errors.push(`Invalid depot entry: ${JSON.stringify(depot)}`);
      continue;
    }
    
    const manifestPath = await findManifestFile(
      depot.depotId,
      depot.manifestId,
      librariesResult.libraries
    );
    
    if (!manifestPath) {
      result.missing.push({
        depotId: depot.depotId,
        manifestId: depot.manifestId,
        appId: depot.appId || '',
        filename: `${depot.depotId}_${depot.manifestId}.manifest`
      });
      continue;
    }
    
    const destFilename = path.basename(manifestPath);
    let destPath;
    
    // Organize by AppID if enabled and AppID is provided
    if (organizeByAppId && depot.appId) {
      const appFolder = path.join(destination, depot.appId.toString());
      try {
        await ensureDestinationExists(appFolder);
        destPath = path.join(appFolder, destFilename);
      } catch (error) {
        result.errors.push(`Failed to create AppID folder for ${depot.appId}: ${error.message}`);
        destPath = path.join(destination, destFilename);
      }
    } else {
      // Fallback to flat structure if no AppID or organization disabled
      destPath = path.join(destination, destFilename);
    }
    
    try {
      await fs.copyFile(manifestPath, destPath);
      
      result.copied.push({
        depotId: depot.depotId,
        manifestId: depot.manifestId,
        appId: depot.appId || '',
        filename: destFilename,
        source: manifestPath,
        destination: destPath
      });
    } catch (error) {
      // More detailed error reporting
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        result.errors.push(
          `Permission denied copying ${manifestPath}. Try running as administrator or check folder permissions.`
        );
      } else if (error.code === 'ENOENT') {
        result.errors.push(
          `Source file not found: ${manifestPath}`
        );
      } else {
        result.errors.push(
          `Failed to copy ${destFilename}: ${error.message} (code: ${error.code})`
        );
      }
    }
  }
  
  result.success = result.copied.length > 0 || result.errors.length === 0;
  return result;
}

async function copyManifestsByAppId(appId, depots, options = {}) {
  const {
    destination = './output',
    steamPathOverride = null
  } = options;
  
  // Add appId to all depot entries
  const depotsWithAppId = depots.map(depot => ({
    ...depot,
    appId: depot.appId || appId
  }));
  
  return await copyManifests({
    depots: depotsWithAppId,
    destination,
    steamPathOverride,
    organizeByAppId: true
  });
}

module.exports = {
  copyManifests,
  copyManifestsByAppId,
  findManifestFile
};
