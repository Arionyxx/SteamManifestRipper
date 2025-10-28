# VDF/ACF Parser

A minimal, dependency-free parser for Valve Data Format (VDF) and ACF files used by Steam.

## Features

- No external dependencies
- Handles nested structures
- Parses both inline and multi-line object definitions
- Supports comments (lines starting with `//`)
- Extracts depot IDs and DLC IDs from appmanifest files

## Functions

### parseVDF(content)

Parses VDF content string into a JavaScript object.

**Parameters:**
- `content` (string): VDF file content

**Returns:** JavaScript object representing the VDF structure

**Example:**
```javascript
const { parseVDF } = require('./parsers/vdf-parser');

const vdf = `
"libraryfolders"
{
  "0"
  {
    "path"    "C:\\\\Program Files (x86)\\\\Steam"
  }
}
`;

const result = parseVDF(vdf);
// { libraryfolders: { "0": { path: "C:\\Program Files (x86)\\Steam" } } }
```

### parseVDFFile(filePath)

Reads and parses a VDF file from disk.

**Parameters:**
- `filePath` (string): Path to VDF file

**Returns:** Promise resolving to `{ success: boolean, data?: object, error?: string }`

**Example:**
```javascript
const { parseVDFFile } = require('./parsers/vdf-parser');

const result = await parseVDFFile('/path/to/libraryfolders.vdf');
if (result.success) {
  console.log(result.data);
}
```

### extractDepotIds(appmanifest)

Extracts depot IDs from a parsed appmanifest object.

Searches in:
- `DepotState`
- `MountedDepots`
- `InstalledDepots`

**Parameters:**
- `appmanifest` (object): Parsed appmanifest.AppState object

**Returns:** Array of depot ID strings

**Example:**
```javascript
const { parseVDFFile, extractDepotIds } = require('./parsers/vdf-parser');

const result = await parseVDFFile('appmanifest_730.acf');
if (result.success) {
  const depotIds = extractDepotIds(result.data.AppState);
  console.log('Depot IDs:', depotIds);
}
```

### extractDLCIds(appmanifest)

Extracts DLC app IDs from a parsed appmanifest object.

Searches in:
- `InstalledDLC`

**Parameters:**
- `appmanifest` (object): Parsed appmanifest.AppState object

**Returns:** Array of DLC app ID strings

**Example:**
```javascript
const { parseVDFFile, extractDLCIds } = require('./parsers/vdf-parser');

const result = await parseVDFFile('appmanifest_730.acf');
if (result.success) {
  const dlcIds = extractDLCIds(result.data.AppState);
  console.log('DLC IDs:', dlcIds);
}
```

## VDF Format

VDF is a text-based format similar to JSON but with a different syntax:

```
"key"   "value"
"object"
{
  "nested_key"   "nested_value"
  "nested_object"
  {
    "deep_key"   "deep_value"
  }
}
```

## Limitations

- Does not preserve comments in output
- Does not handle arrays (Steam VDF doesn't use them in standard files)
- Values are always strings (no automatic type conversion)
- Assumes valid VDF syntax (minimal error recovery)

## Testing

Run tests with:
```bash
node src/tests/vdf-parser.test.js
```

Tests cover:
- Basic VDF parsing
- Nested structures (libraryfolders.vdf)
- Appmanifest parsing with depot extraction
- DLC ID extraction
