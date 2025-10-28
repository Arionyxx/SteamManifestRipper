# Depot Scanning Revamp Documentation

## Overview

This document describes the revamped depot scanning functionality that simplifies Steam discovery, scans multiple depotcache locations, and extracts depot encryption keys from Steam's config.vdf.

## Key Changes

### 1. Simplified Steam Discovery

**Before:**
- Used `discoverLibraryFolders()` to find multiple Steam library locations
- Scanned each library's `steamapps/depotcache` directory

**After:**
- Uses a single Steam root path (default: `C:/Program Files (x86)/Steam`)
- Accepts optional `steamPathOverride` parameter from the renderer
- Implemented in `src/steam/config-reader.js` via `resolveSteamRoot()`

### 2. Multiple Depotcache Locations

The scanner now checks **both** depotcache locations:
- `Steam/depotcache/*.manifest`
- `Steam/config/depotcache/*.manifest`

This ensures all manifest files are discovered regardless of where Steam stores them.

### 3. Depot Encryption Keys

**New Feature:** Parses `Steam/config/config.vdf` to extract depot decryption keys.

The config.vdf structure looks like:
```
"InstallConfigStore"
{
  "Software"
  {
    "Valve"
    {
      "Steam"
      {
        "depots"
        {
          "228980"
          {
            "DecryptionKey"    "ABCDEF1234567890..."
          }
        }
      }
    }
  }
}
```

Keys are:
- Extracted and validated (must be valid hexadecimal strings)
- Mapped by depot ID
- Attached to each manifest in the scan results as `decryptionKey` field

### 4. Enhanced Results

Scan results now include:
- `steamRoot`: The Steam installation path used for scanning
- `decryptionKey`: Hex encryption key for each manifest (if available)
- `location`: The specific depotcache directory where each manifest was found
- `warnings`: Array of warnings for genuinely missing resources (e.g., missing keys)
- `errors`: Non-fatal errors encountered during scanning

**Example result:**
```javascript
{
  "success": true,
  "steamRoot": "C:/Program Files (x86)/Steam",
  "files": [
    {
      "path": "C:/Program Files (x86)/Steam/depotcache/228980_1234567890.manifest",
      "name": "228980_1234567890.manifest",
      "manifestId": "1234567890",
      "depotId": "228980",
      "appId": "570",
      "decryptionKey": "ABCDEF1234567890...",
      "type": "base",
      "status": "valid",
      "errors": [],
      "location": "C:/Program Files (x86)/Steam/depotcache"
    }
  ],
  "errors": [],
  "warnings": []
}
```

### 5. Graceful Error Handling

**Removed:** Hard-coded "depotcache directory not found" warnings for valid Steam installs

**Added:**
- Graceful handling of missing depotcache directories (silently skips if not present)
- Warnings only for genuinely missing resources:
  - When a manifest's depot ID has no corresponding decryption key in config.vdf
  - When critical files are unexpectedly missing

## API Changes

### scanDepotCache()

**New parameters:**
```javascript
await scanDepotCache({
  defaultAppId: '',           // Optional default app ID
  inferAppId: true,           // Whether to infer app ID from appmanifests
  steamPathOverride: null     // Optional Steam path override
});
```

**New result fields:**
```javascript
{
  success: boolean,
  steamRoot: string | null,   // NEW: Steam installation path
  files: Array<{
    // ... existing fields ...
    decryptionKey: string,    // NEW: Hex key for this depot
    location: string          // NEW: Which depotcache directory
  }>,
  errors: string[],
  warnings: string[]          // NEW: Warnings for missing keys, etc.
}
```

### IPC Handler Changes

The `steam:scanDepotcache` IPC handler now accepts `steamPathOverride`:

```javascript
// From renderer
window.electronAPI.scanSteamDepotCache({
  inferAppId: true,
  steamPathOverride: 'D:/CustomSteam'
});
```

## New Modules

### src/steam/config-reader.js

Provides:
- `parseDepotKeys(configVdfPath)`: Extracts depot decryption keys from config.vdf
- `resolveSteamRoot(steamPathOverride)`: Resolves Steam installation path

### src/tests/config-reader.test.js

Comprehensive tests for:
- Depot key extraction from config.vdf
- Handling of missing config files
- Validation of hex keys
- Manifest filename parsing (depot ID and manifest ID extraction)

### src/tests/integration.test.js

End-to-end integration tests:
- Scanning both depotcache locations
- Attaching decryption keys to manifests
- Inferring app IDs from appmanifests
- Generating warnings for missing keys

## Test Coverage

Run all tests:
```bash
npm test
```

Current test suites:
1. **VDF Parser Tests** (existing): Basic VDF parsing, depot extraction, DLC extraction
2. **Config Reader Tests** (new): Config parsing, key extraction, error handling
3. **Integration Tests** (new): End-to-end depot scanning scenarios

All tests pass with 100% success rate.

## Migration Notes

### Breaking Changes

1. **Result structure**: `libraries` field replaced with `steamRoot`
2. **File structure**: Each file now has `decryptionKey` and `location` fields

### For Renderer Code

If you were using the `libraries` field from scan results:

**Before:**
```javascript
result.libraries.forEach(library => {
  console.log('Library:', library);
});
```

**After:**
```javascript
console.log('Steam Root:', result.steamRoot);
```

### For Main Process Code

No changes needed if you're just calling `scanDepotCache()`. The function signature is backward compatible (new parameters are optional).

## Examples

### Basic Scanning
```javascript
const result = await scanDepotCache();
console.log(`Found ${result.files.length} manifests`);
console.log(`Steam root: ${result.steamRoot}`);
```

### Scanning with Override
```javascript
const result = await scanDepotCache({
  steamPathOverride: 'D:/SteamLibrary',
  inferAppId: true
});
```

### Checking for Missing Keys
```javascript
const result = await scanDepotCache();
if (result.warnings.length > 0) {
  console.log('Warnings:', result.warnings);
  // Example: "No decryption key found for depot 12345 (manifest: 12345_...)"
}
```

### Using Decryption Keys
```javascript
const result = await scanDepotCache();
result.files.forEach(file => {
  if (file.decryptionKey) {
    console.log(`Depot ${file.depotId} key: ${file.decryptionKey}`);
  } else {
    console.log(`Depot ${file.depotId} has no key`);
  }
});
```

## Acceptance Criteria Verification

✅ **Scanning returns manifests from both depotcache locations** with correct IDs and keys  
✅ **Missing depot keys generate warnings** but manifests remain in the list  
✅ **No spurious "depotcache not found" warnings** for valid Steam installs  
✅ **Override path support** - scans custom location instead of default  
✅ **Comprehensive test coverage** - all tests pass via `npm test`

## Future Enhancements

Potential improvements for future iterations:
- Support for multiple Steam library folders (if needed)
- Caching of parsed config.vdf for performance
- Live monitoring of depotcache directories for new manifests
- Automatic key refresh when config.vdf changes
