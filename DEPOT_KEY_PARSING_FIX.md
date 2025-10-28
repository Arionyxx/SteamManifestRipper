# Config.vdf Depot Key Parsing Fix

## Problem
The config.vdf parser needed improvements to handle various edge cases and ensure robust extraction of DecryptionKey values for all depot IDs.

## Changes Made

### 1. Enhanced `config-reader.js`
- **Multiple Path Support**: The parser now tries multiple possible paths to find the depots object, handling different Steam configuration file structures:
  - Standard: `InstallConfigStore -> Software -> Valve -> Steam -> depots`
  - Alternative paths for different Steam versions or configurations
  
- **Improved Key Case Handling**: Now checks for multiple case variations of the DecryptionKey field:
  - `DecryptionKey`
  - `decryptionkey`
  - `decryptionKey`
  - `DECRYPTIONKEY`

- **Better Validation**: Enhanced hex string validation to ensure keys are properly formatted

### 2. Added Test Coverage
- Created `sample-config-201790.vdf` fixture with real-world depot IDs mentioned in the ticket:
  - Depot 201791 (for app 201790)
  - Depot 413151
  - Depot 594653
  
- Added `testRealWorldDepotKeys()` test case to verify 64-character hex keys are extracted correctly

- Created `test-depot-key-parsing.js` demonstration script

## Test Results

All tests pass, including:
- ✓ Depot key extraction with 32-character hex keys
- ✓ Depot key extraction with 64-character hex keys (real Steam keys)
- ✓ Invalid hex key filtering
- ✓ Missing config file handling
- ✓ Empty config structure handling

## Example Usage

```javascript
const { parseDepotKeys } = require('./src/steam/config-reader');

const result = await parseDepotKeys('/path/to/Steam/config/config.vdf');

// result.depotKeys = {
//   "201791": "07e18a6715cee99f3c872f9fc3f7484243f7bf6c8dcbf57bebd21c3ed7e8e08a",
//   "413151": "ff71699a17787b798d901cb27398556eb69a498b690b4392b2ffedcacc1019ff",
//   ...
// }
```

## Config.vdf Structure

The parser correctly handles depot entries in this format:

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
                        "DecryptionKey"  "07e18a6715cee99f3c872f9fc3f7484243f7bf6c8dcbf57bebd21c3ed7e8e08a"
                    }
                    "413151"
                    {
                        "DecryptionKey"  "ff71699a17787b798d901cb27398556eb69a498b690b4392b2ffedcacc1019ff"
                    }
                }
            }
        }
    }
}
```

## Integration

The `app-loader.js` module uses this parser to extract depot keys and attach them to depot information:

1. Parse appmanifest_{app_id}.acf to get depot IDs
2. Call `parseDepotKeys()` to get the full key map from config.vdf
3. For each depot, look up `depotKeys[depotId]`
4. If found, attach the key; if not found, mark as "missing"

## Verification

Run the test suite:
```bash
npm test
```

Run the demonstration script:
```bash
node test-depot-key-parsing.js
```

All tests should pass, confirming that depot keys are correctly extracted from config.vdf files.
