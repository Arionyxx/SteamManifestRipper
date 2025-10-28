# Changelog

## [Depot Scanning Revamp] - 2024

### Added
- **New Module**: `src/steam/config-reader.js`
  - `resolveSteamRoot()` - Resolves Steam installation path with optional override
  - `parseDepotKeys()` - Extracts depot decryption keys from config.vdf
  
- **New Test Suites**:
  - `src/tests/config-reader.test.js` - Tests for config parsing and key extraction
  - `src/tests/integration.test.js` - End-to-end depot scanning tests
  
- **Test Fixtures**:
  - `src/tests/fixtures/sample-config.vdf` - Sample Steam config for testing
  
- **Documentation**:
  - `DEPOT_SCANNING_REVAMP.md` - Comprehensive documentation of the revamp
  - `IMPLEMENTATION_SUMMARY.md` - Detailed implementation summary
  
- **New Features**:
  - Depot decryption keys now extracted from `Steam/config/config.vdf`
  - Warnings system for missing depot keys
  - Support for `steamPathOverride` parameter in scan operations
  - Scanning of `Steam/config/depotcache` in addition to `Steam/depotcache`
  - `decryptionKey` field added to manifest results
  - `location` field shows which depotcache directory each manifest came from

### Changed
- **`src/steam/depot-scanner.js`** (Complete Rewrite):
  - Now uses single Steam root path instead of multiple library discovery
  - `scanDepotCache()` accepts `steamPathOverride` parameter
  - `findManifestFiles()` gracefully handles missing directories
  - Returns `steamRoot` instead of `libraries` array
  - Returns `warnings` array for missing keys and other non-fatal issues
  - All manifest results include `decryptionKey` and `location` fields
  
- **`main.js`**:
  - Replaced `discoverLibraryFolders` with `resolveSteamRoot`
  - `dialog:selectFiles` handler uses single Steam root
  - Error responses updated with new result structure
  
- **`src/examples/test-scanner.js`**:
  - Updated to use new `testSteamRootResolution()` function
  - Displays decryption keys and locations
  - Shows warnings in output
  
- **`src/examples/simple-test.js`**:
  - Rewritten to test Steam root resolution and depot key extraction
  
- **`package.json`**:
  - Added `test` script to run all test suites

### Fixed
- Eliminated spurious "depotcache directory not found" warnings
- Proper handling of missing depotcache directories
- Better error messages for genuinely missing resources

### Breaking Changes
- **Result Structure**: `libraries` field replaced with `steamRoot` (single path)
- **File Object**: `library` field renamed to `location`
- **New Fields**: `decryptionKey` (string) and `warnings` (array) added to results

### Migration Guide
```javascript
// Before
result.libraries.forEach(lib => {
  console.log('Library:', lib);
});

// After
console.log('Steam Root:', result.steamRoot);

// File location access
// Before: file.library
// After:  file.location
```

### Test Results
- All 10 tests passing (100% success rate)
- VDF Parser Tests: 3/3 ✓
- Config Reader Tests: 5/5 ✓
- Integration Tests: 2/2 ✓

### Security
- Hex key validation ensures only valid hexadecimal strings are accepted
- Path validation before file system operations
- All file operations wrapped in proper error handling

### Performance
- Reduced file system operations (single root vs multiple libraries)
- O(1) depot key lookups via hash map
- Graceful handling of missing directories (no unnecessary errors)
