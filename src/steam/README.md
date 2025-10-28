# Steam Depot Scanner

This module provides Steam-aware scanning functionality to automatically discover Steam libraries and scan depotcache directories for manifest files.

## Modules

### library-discovery.js

Discovers Steam installation and library folders on Windows, Linux, and macOS.

**Functions:**

- `getDefaultSteamPath()` - Returns the platform-specific default Steam installation path
  - Windows: `C:\Program Files (x86)\Steam`
  - macOS: `~/Library/Application Support/Steam`
  - Linux: `~/.steam/steam`

- `discoverLibraryFolders()` - Discovers all Steam library folders
  - Finds the default Steam installation
  - Parses `libraryfolders.vdf` to find additional library locations
  - Returns: `{ success, libraries, errors }`

- `getDepotCachePath(libraryPath)` - Returns the depotcache path for a library
- `getSteamAppsPath(libraryPath)` - Returns the steamapps path for a library

### depot-scanner.js

Scans Steam libraries for depot manifest files and builds app-depot mappings.

**Functions:**

- `scanDepotCache(options)` - Main scanning function
  - Options:
    - `defaultAppId`: Default APPID to use when inference fails
    - `inferAppId`: Whether to infer APPID from depot mappings (default: true)
  - Returns: `{ success, files, libraries, errors, warnings }`
  - Each file object contains:
    - `path`: Full path to manifest file
    - `name`: Filename
    - `manifestId`: Extracted 10-22 digit manifest ID
    - `depotId`: Extracted depot ID from filename prefix
    - `appId`: Inferred or default APPID
    - `type`: `base`, `dlc`, or `orphan`
    - `status`: `valid` or `invalid`
    - `errors`: Array of validation errors
    - `library`: Library path where file was found

- `parseManifestFile(filePath, options)` - Parses a single manifest file
  - Options: same as `scanDepotCache`
  - Returns: Single file object

- `extractManifestId(filename)` - Extracts the longest 10-22 digit token from filename
- `extractDepotId(filename)` - Extracts depot ID from filename prefix (e.g., `12345_...`)
- `buildAppDepotMap(libraryPath)` - Builds depot→app mappings from appmanifest files

## Usage Example

```javascript
const { scanDepotCache } = require('./steam/depot-scanner');

async function scan() {
  const result = await scanDepotCache({
    defaultAppId: '730',
    inferAppId: true
  });
  
  if (result.success) {
    console.log(`Found ${result.files.length} manifest files`);
    console.log(`Scanned ${result.libraries.length} libraries`);
    
    result.files.forEach(file => {
      console.log(`${file.name}: ${file.type} - ${file.status}`);
    });
  }
}
```

## IPC Integration

The scanner is integrated with Electron IPC:

- `steam:scanDepotcache` - Scans all Steam libraries for manifest files
- `dialog:selectFiles` - Now uses the same parsing pipeline for manual file selection

Both handlers accept `defaultAppId` and `inferAppId` options from the renderer process.

## File Type Classification

- **base**: Depot belongs to a base game app
- **dlc**: Depot belongs to a DLC app
- **orphan**: Depot could not be mapped to any app, or APPID is missing

## Status Classification

- **valid**: All required fields are present and valid
- **invalid**: Missing or malformed manifestId, depotId, or appId

## Error Handling

The module collects errors rather than throwing, allowing partial success:
- Missing Steam installation
- Inaccessible library folders
- Malformed VDF files
- Missing appmanifest files
- Unreadable depotcache directories

All errors are returned in the `errors` array while still returning any successfully scanned data.
