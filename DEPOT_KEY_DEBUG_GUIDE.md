# Depot Key Extraction Debug Guide

## Problem

Depot decryption keys were not being found in `config.vdf` even though they existed in the file. This guide documents the debugging features added and how to use them.

## Debugging Features Added

### 1. Extensive Logging in `config-reader.js`

The `parseDepotKeys()` function now includes comprehensive debug logging:

- **File Access**: Confirms the config.vdf path and accessibility
- **File Content**: Logs file size and first 500 characters
- **Parsing Progress**: Shows VDF parsing success/failure
- **Structure Analysis**: Displays root keys and the path where depots were found
- **Depot Processing**: Logs each depot ID as it's processed
- **Key Extraction**: Shows each DecryptionKey found and validated
- **Final Summary**: Total keys extracted and the complete depot key map

### 2. Logging in `app-loader.js`

The `loadAppData()` function logs:

- Config.vdf path being used
- Depot keys received from the parser
- Each depot lookup attempt
- Whether keys are found or missing for each depot
- Available depot IDs when a key is not found

### 3. Fallback Parsing Methods

If the standard VDF parser fails to find any keys, the system automatically tries:

#### Regex-Based Parser
- Uses pattern: `/"(\d+)"\s*\{\s*"DecryptionKey"\s+"([0-9a-fA-F]{32,64})"\s*\}/g`
- Handles flexible whitespace between elements
- Validates hex keys (32-64 characters)

#### Line-by-Line Parser
- Tracks brace depth to understand structure
- Identifies depot IDs from quoted numeric values
- Extracts DecryptionKey within depot blocks
- Most robust fallback for unusual formatting

## How to Use the Debug Logs

### In Development

When running the Electron app with `npm start` or `npm run dev`, all debug logs appear in:
- **Terminal**: Where you launched the app
- **DevTools Console**: Open with F12 in the Electron window

### Reading the Logs

Example log sequence for successful key extraction:

```
[DEBUG] parseDepotKeys - Reading config.vdf from: C:\Program Files (x86)\Steam\config\config.vdf
[DEBUG] parseDepotKeys - Config file exists and is accessible
[DEBUG] parseDepotKeys - File size: 12345 bytes
[DEBUG] parseDepotKeys - First 500 chars: "InstallConfigStore" { "Software" ...
[DEBUG] parseDepotKeys - VDF parsing succeeded
[DEBUG] parseDepotKeys - Root keys in parsed data: [ 'InstallConfigStore' ]
[DEBUG] parseDepotKeys - Found depots object at path: InstallConfigStore.Software.Valve.Steam.depots
[DEBUG] parseDepotKeys - Depot entries found: 10
[DEBUG] parseDepotKeys - Depot IDs: [ '201791', '413151', '594653', ... ]
[DEBUG] parseDepotKeys - Processing depot: 201791
[DEBUG] parseDepotKeys - Depot data keys: [ 'DecryptionKey' ]
[DEBUG] parseDepotKeys - Found DecryptionKey for depot 201791 : 07e18a6715cee99f...
[DEBUG] parseDepotKeys - Validated and stored key for depot 201791
...
[DEBUG] parseDepotKeys - Total depot keys extracted: 10
[DEBUG] parseDepotKeys - Final depot key map: [ '201791', '413151', '594653', ... ]
```

### Diagnosing Issues

#### Issue: No keys found

Look for these log lines:

```
[DEBUG] parseDepotKeys - No depots object found in any known path
```

**Solution**: The config.vdf structure might be non-standard. Check the "Root keys in parsed data" log to see what keys exist at the root level.

#### Issue: Depot IDs found but no DecryptionKey

```
[DEBUG] parseDepotKeys - Processing depot: 201791
[DEBUG] parseDepotKeys - Depot data keys: [ 'SomeOtherKey' ]
[DEBUG] parseDepotKeys - No DecryptionKey found for depot 201791
```

**Solution**: The depot block exists but doesn't contain a DecryptionKey field. This is normal for depots that don't require decryption.

#### Issue: Keys found but validation fails

```
[DEBUG] parseDepotKeys - Found DecryptionKey for depot 201791 : invalid-chars...
[DEBUG] parseDepotKeys - Invalid hex key for depot 201791 - rejected
```

**Solution**: The key contains non-hexadecimal characters or formatting issues.

#### Issue: Fallback parser triggered

```
[DEBUG] parseDepotKeys - No keys found with VDF parser, trying regex fallback...
[DEBUG] parseDepotKeys - Regex fallback succeeded! Found 10 depot keys
```

**Meaning**: The standard VDF parser failed but the regex parser succeeded. This suggests unusual formatting in the config.vdf file.

## Test Scripts

### Test with Fixture Files

```bash
node src/examples/test-depot-keys.js
```

This tests:
- Sample config files with known depot keys
- Real Steam config.vdf if available on your system
- Specific depot IDs mentioned in issues (201791, 413151)

### Test Fallback Parsing

```bash
node src/examples/test-fallback-parsing.js
```

This verifies the fallback parsing methods work correctly.

## Config.vdf Format

The expected format is:

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
                    "201791"
                    {
                        "DecryptionKey"		"07e18a6715cee99f3c872f9fc3f7484243f7bf6c8dcbf57bebd21c3ed7e8e08a"
                    }
                    "413151"
                    {
                        "DecryptionKey"		"ff71699a17787b798d901cb27398556eb69a498b690b4392b2ffedcacc1019ff"
                    }
                }
            }
        }
    }
}
```

Alternative structures that are also supported:
- `Software.Valve.Steam.depots` (without InstallConfigStore)
- `Steam.depots` (directly under root)
- `depots` (at root level)

## Verification Steps

To verify depot keys are being extracted correctly:

1. **Run the app** and load an app with depot manifests
2. **Check the console** for debug logs showing:
   - Config file path and size
   - Number of depot entries found
   - Each depot ID and its key being processed
   - Final count of keys in the map
3. **Check the UI** - depot table should show decryption keys in the "Decryption Key" column
4. **Generate Lua** - the output should contain all depot keys

## Success Criteria

✓ Console logs show depot keys being found  
✓ Depot 201791 returns the correct 64-char hex string  
✓ All depot IDs from config.vdf are in the returned map  
✓ App manifest loading shows keys in the UI table  
✓ No "missing key" warnings for depots that have keys in config.vdf  

## Troubleshooting Common Issues

### Keys exist but show as "missing"

**Symptoms**:
- Debug logs show keys extracted successfully
- UI shows keys as "missing" or empty

**Check**:
```
[DEBUG] loadAppData - Looking up key for depot: 201791
[DEBUG] loadAppData - NO KEY FOUND for depot: 201791
[DEBUG] loadAppData - Available depot IDs in map: [ '201792', '413151', ... ]
```

**Cause**: Depot ID mismatch. Notice depot 201791 is not in the available IDs list but 201792 is.

**Solution**: Verify the depot ID in the app manifest matches the depot ID in config.vdf. Sometimes Steam uses different depot IDs for different platforms or versions.

### Config file not found

```
[DEBUG] parseDepotKeys - Config file not found or not accessible
```

**Check**:
- Steam installation path is correct
- File permissions allow reading the config.vdf
- Path uses correct separators for your OS

### VDF parsing fails

```
[DEBUG] parseDepotKeys - VDF parsing failed: Unexpected token...
```

**Solutions**:
1. Check if file has unusual encoding (UTF-16, etc.)
2. Look for syntax errors in the VDF file
3. The fallback parsers will automatically try alternative methods

## Removing Debug Logs

When debugging is complete and the issue is resolved, you can:

1. **Keep the logs** (recommended) - They're useful for future debugging
2. **Disable selective logs** - Comment out specific console.log statements
3. **Add a debug flag** - Wrap logs in `if (DEBUG_MODE)` checks

Currently, all debug logs are active to help diagnose the key extraction issue.
