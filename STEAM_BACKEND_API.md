# Steam Backend API Documentation

This document describes the overhauled Steam backend API that provides targeted, app-specific functionality for loading Steam app data and managing depot manifests.

## Overview

The new backend replaces the old depot cache scanning approach with a more focused workflow:

1. **Discover Steam installation** - Query Windows registry or use platform-specific defaults
2. **Load app-specific data** - Parse appmanifest files to extract depot information
3. **Classify depots** - Automatically identify main depots vs DLC
4. **Extract decryption keys** - Map depot IDs to decryption keys from config.vdf
5. **Copy manifests** - Optionally copy specific manifest files to a destination

## Modules

### `registry-reader.js`

Provides Windows registry access for Steam installation discovery.

#### Functions

**`getSteamInstallPathFromRegistry()`**

Queries Windows registry for Steam installation path.

```javascript
const { getSteamInstallPathFromRegistry } = require('./steam/registry-reader');

const result = await getSteamInstallPathFromRegistry();
if (result.success) {
  console.log('Steam path:', result.path);
}
```

**Returns:**
```javascript
{
  success: boolean,
  path: string | null,
  error: string | null
}
```

### `config-reader.js`

Enhanced Steam configuration utilities with registry support.

#### Functions

**`resolveSteamRoot(steamPathOverride?)`**

Discovers Steam installation using registry (Windows), then falls back to platform defaults.

```javascript
const { resolveSteamRoot } = require('./steam/config-reader');

const result = await resolveSteamRoot();
if (result.success) {
  console.log('Steam root:', result.steamRoot);
}
```

**Parameters:**
- `steamPathOverride` (optional) - Override path to Steam installation

**Returns:**
```javascript
{
  success: boolean,
  steamRoot: string | null,
  errors: string[]
}
```

**`parseDepotKeys(configVdfPath)`**

Extracts depot decryption keys from config.vdf.

```javascript
const { parseDepotKeys } = require('./steam/config-reader');

const result = await parseDepotKeys('/path/to/config.vdf');
console.log('Depot keys:', result.depotKeys);
```

**Returns:**
```javascript
{
  depotKeys: { [depotId: string]: string },
  errors: string[]
}
```

### `app-loader.js`

Core module for loading app-specific data.

#### Functions

**`loadAppData(options)`**

Loads comprehensive data for a specific Steam app ID.

```javascript
const { loadAppData } = require('./steam/app-loader');

const result = await loadAppData({
  appId: '228980',
  includeDlc: true,
  steamPathOverride: null
});

if (result.success) {
  console.log('App:', result.appName);
  console.log('Depots:', result.depots.length);
}
```

**Parameters (options object):**
- `appId` (required) - Steam app ID to load
- `includeDlc` (optional, default: true) - Include DLC depots
- `steamPathOverride` (optional) - Override Steam installation path

**Returns:**
```javascript
{
  success: boolean,
  appId: string,
  appName: string,
  depots: [
    {
      depotId: string,
      manifestId: string,
      type: 'main' | 'dlc' | 'unknown',
      decryptionKey: string
    }
  ],
  missingKeys: string[],  // Depot IDs with missing keys
  errors: string[],
  warnings: string[]
}
```

**Depot Classification Rules:**
- **Main depot**: `depotId <= appId + 100000`
- **DLC depot**: `depotId > appId + 100000`

**`classifyDepot(depotId, appId)`**

Classifies a depot as main or DLC based on ID relationship.

```javascript
const { classifyDepot } = require('./steam/app-loader');

const type = classifyDepot('228980', '228980');  // 'main'
const type2 = classifyDepot('329081', '228980'); // 'dlc'
```

**Returns:** `'main' | 'dlc' | 'unknown'`

### `manifest-copier.js`

Utilities for copying manifest files from depot cache.

#### Functions

**`copyManifests(options)`**

Copies specified manifest files to a destination directory.

```javascript
const { copyManifests } = require('./steam/manifest-copier');

const result = await copyManifests({
  depots: [
    { depotId: '228980', manifestId: '1234567890123456789' },
    { depotId: '228982', manifestId: '9876543210987654321' }
  ],
  destination: '/path/to/output',
  steamPathOverride: null
});

console.log('Copied:', result.copied.length);
console.log('Missing:', result.missing.length);
```

**Parameters (options object):**
- `depots` (required) - Array of `{ depotId, manifestId }` objects
- `destination` (required) - Output directory path
- `steamPathOverride` (optional) - Override Steam installation path

**Returns:**
```javascript
{
  success: boolean,
  copied: [
    {
      depotId: string,
      manifestId: string,
      filename: string,
      source: string,
      destination: string
    }
  ],
  missing: [
    {
      depotId: string,
      manifestId: string,
      filename: string
    }
  ],
  errors: string[]
}
```

## IPC API (Electron)

### `steam:loadAppData`

Load app data from the main process.

```javascript
// Renderer process
const result = await window.electronAPI.loadAppData({
  appId: '228980',
  includeDlc: true
});
```

### `steam:copyManifests`

Copy manifest files from the main process.

```javascript
// Renderer process
const result = await window.electronAPI.copyManifests({
  depots: [
    { depotId: '228980', manifestId: '1234567890123456789' }
  ],
  destination: '/path/to/output'
});
```

### `dialog:selectFolder`

Open a folder selection dialog.

```javascript
// Renderer process
const result = await window.electronAPI.selectFolder();
if (result.success) {
  console.log('Selected:', result.path);
}
```

## Complete Workflow Example

```javascript
const { loadAppData } = require('./steam/app-loader');
const { copyManifests } = require('./steam/manifest-copier');

async function processApp(appId, outputDir) {
  // 1. Load app data
  const appData = await loadAppData({
    appId,
    includeDlc: false  // Exclude DLC
  });
  
  if (!appData.success) {
    console.error('Failed to load app:', appData.errors);
    return;
  }
  
  console.log(`Processing ${appData.appName}`);
  console.log(`Found ${appData.depots.length} main depots`);
  
  // 2. Filter depots with keys
  const depotsWithKeys = appData.depots.filter(d => d.decryptionKey);
  console.log(`${depotsWithKeys.length} depots have decryption keys`);
  
  // 3. Copy manifest files
  const copyResult = await copyManifests({
    depots: depotsWithKeys,
    destination: outputDir
  });
  
  if (copyResult.success) {
    console.log(`Copied ${copyResult.copied.length} manifest files`);
    
    if (copyResult.missing.length > 0) {
      console.warn(`Could not find ${copyResult.missing.length} manifest files`);
    }
  }
  
  return {
    appData,
    copyResult
  };
}
```

## Migration from Old API

### Before (Old API)

```javascript
// Old approach: scan all depot cache files
const result = await scanDepotCache({
  defaultAppId: '228980',
  inferAppId: true
});

// Returns all manifest files from depot cache
// Had to manually filter and process
```

### After (New API)

```javascript
// New approach: load specific app data
const result = await loadAppData({
  appId: '228980',
  includeDlc: false
});

// Returns only depots for the specified app
// Automatically classified and with keys attached
```

## Key Improvements

1. **Registry-based discovery** - Windows registry querying with fallbacks
2. **App-focused** - Target specific apps instead of scanning everything
3. **Automatic classification** - Depots automatically identified as main or DLC
4. **Key tracking** - Missing decryption keys are tracked and reported
5. **Selective copying** - Copy only the manifest files you need
6. **Better error handling** - Clear errors and warnings at each step
7. **Cross-platform** - Works on Windows, macOS, and Linux

## Platform Support

- **Windows**: Registry query → Default paths
- **macOS**: `~/Library/Application Support/Steam`
- **Linux**: `~/.steam/steam` or `~/.local/share/Steam`

## Error Handling

All functions return structured results with separate error and warning arrays:

```javascript
const result = await loadAppData({ appId: '12345' });

if (!result.success) {
  // Critical errors that prevented operation
  console.error('Errors:', result.errors);
} else {
  // Operation succeeded but with warnings
  if (result.warnings.length > 0) {
    console.warn('Warnings:', result.warnings);
  }
}
```
