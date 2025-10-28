const fs = require('fs').promises;
const path = require('path');
const { discoverLibraryFolders } = require('./library-discovery');

async function findManifestFile(depotId, manifestId, libraries) {
  const manifestFilename = `${depotId}_${manifestId}.manifest`;
  
  for (const library of libraries) {
    const depotcachePath = path.join(library, 'steamapps', 'depotcache');
    const manifestPath = path.join(depotcachePath, manifestFilename);
    
    try {
      await fs.access(manifestPath);
      return manifestPath;
    } catch (error) {
    }
  }
  
  return null;
}

async function copyManifests(options = {}) {
  const { depots = [], destination, steamPathOverride = null } = options;
  
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
  
  try {
    await fs.access(destination);
  } catch (error) {
    result.errors.push(`Destination directory not accessible: ${destination}`);
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
        filename: `${depot.depotId}_${depot.manifestId}.manifest`
      });
      continue;
    }
    
    const destFilename = path.basename(manifestPath);
    const destPath = path.join(destination, destFilename);
    
    try {
      await fs.copyFile(manifestPath, destPath);
      result.copied.push({
        depotId: depot.depotId,
        manifestId: depot.manifestId,
        filename: destFilename,
        source: manifestPath,
        destination: destPath
      });
    } catch (error) {
      result.errors.push(`Failed to copy ${manifestPath}: ${error.message}`);
    }
  }
  
  result.success = true;
  return result;
}

module.exports = {
  copyManifests,
  findManifestFile
};
