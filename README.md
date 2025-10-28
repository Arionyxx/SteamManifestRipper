# Depot Manifest Manager

An Electron 30 application for managing Steam depot manifest files with automatic Steam library scanning.

## Features

- **Steam-Aware Scanning**: Automatically discovers and scans Steam libraries on Windows, Linux, and macOS
- **VDF/ACF Parser**: Built-in parser for Steam's VDF and ACF file formats
- **Depot-App Mapping**: Automatically maps depot IDs to app IDs from appmanifest files
- **DLC Detection**: Identifies and classifies DLC depots
- **Manual File Selection**: Select individual manifest files with automatic parsing
- **Lua Export**: Export manifest data in various Lua table structures
- **Electron 30**: Modern desktop application framework
- **Node.js 18**: Long-term support version
- **Tailwind CSS**: Utility-first CSS framework
- **DaisyUI**: Component library built on Tailwind CSS
- **Context Isolation**: Secure preload script setup

## Project Structure

```
.
├── main.js                    # Main process (Electron entry point)
├── preload.js                 # Preload script with contextBridge
├── renderer.js                # Renderer process logic
├── index.html                 # Application UI
├── package.json               # Project dependencies and scripts
├── tailwind.config.js         # Tailwind CSS configuration
├── src/
│   ├── parsers/              # VDF/ACF file parsers
│   │   ├── vdf-parser.js     # Minimal VDF parser
│   │   └── README.md         # Parser documentation
│   ├── steam/                # Steam library scanning
│   │   ├── library-discovery.js  # Library folder discovery
│   │   ├── depot-scanner.js      # Depot cache scanner
│   │   └── README.md         # Scanner documentation
│   ├── tests/                # Test files
│   │   └── vdf-parser.test.js
│   ├── examples/             # Example usage
│   │   ├── simple-test.js
│   │   └── test-scanner.js
│   ├── styles.css            # Tailwind CSS entry point
│   └── output.css            # Generated CSS (do not edit)
└── README.md                 # This file
```

## Installation

1. Install dependencies:

```bash
npm install
```

## Development

### Building Tailwind CSS

Before running the application, you need to compile Tailwind CSS:

```bash
npm run build:tailwind
```

This command generates `src/output.css` from `src/styles.css` using the Tailwind configuration.

### Running the Application

Start the Electron application:

```bash
npm start
```

This command automatically builds Tailwind CSS and then launches the Electron app.

### Watch Mode for Tailwind

During development, you can run Tailwind in watch mode to automatically rebuild CSS on changes:

```bash
npm run watch:tailwind
```

Keep this running in a separate terminal while developing.

## Available Scripts

- **`npm start`**: Build Tailwind CSS and start the Electron app
- **`npm run build:tailwind`**: Compile Tailwind CSS once
- **`npm run watch:tailwind`**: Watch for changes and recompile Tailwind CSS automatically

## Usage

### Steam Depot Scanning

Click the **"Scan Steam"** button to automatically:
1. Discover Steam installation on your system
2. Parse `libraryfolders.vdf` to find all library locations
3. Build depot→app mappings from all `appmanifest_*.acf` files
4. Scan all `steamapps/depotcache` directories for `.manifest` files
5. Automatically infer APPID from depot mappings
6. Classify files as `base`, `dlc`, or `orphan`
7. Validate all extracted data

### Manual Folder Scanning

Click **"Scan Folder"** to select and scan a specific folder for manifest files. This is useful for:
- Scanning backup directories
- Processing manifests outside Steam libraries
- Testing with custom collections

### Manual File Selection

Click **"Select Files"** to manually choose specific manifest files. The parser will:
- Extract manifest IDs (10-22 digit tokens)
- Extract depot IDs from filename prefixes
- Attempt to infer APPID from Steam's appmanifest files
- Apply validation rules

### Configuration

- **Default APPID**: Fallback APPID when inference fails
- **Infer APPID**: Enable/disable automatic APPID inference from depot mappings
- **Output Structure**: Choose between flat, nested, or grouped Lua table structures
- **Dump Mode**: Configure detail level for exports
- **Filename Pattern**: Customize output filename using `{appid}`, `{depotid}`, `{manifestid}` placeholders

### File Classification

Files are automatically classified by type:
- **base**: Depot belongs to a base game
- **dlc**: Depot belongs to DLC content
- **orphan**: Depot could not be mapped to any app

And by status:
- **valid**: All required fields present and correct
- **invalid**: Missing or malformed data

## Architecture

### Main Process (main.js)

The main process creates and manages the application window. It:
- Creates a BrowserWindow with 1600x1000 dimensions
- Enables context isolation for security
- Loads the preload script before the renderer
- Handles application lifecycle events
- Implements IPC handlers for:
  - `steam:scanDepotcache` - Steam-aware depot scanning
  - `dialog:selectFolder` - Folder selection
  - `dialog:selectFiles` - File selection with parsing
  - `scan:files` - Manual folder scanning
  - `save:output` - Lua file export

### Preload Script (preload.js)

The preload script bridges the main and renderer processes securely using `contextBridge`. It exposes:
- Platform information
- Node.js, Chrome, and Electron version information
- IPC methods:
  - `scanDepotcache(options)` - Steam depot scanning
  - `selectFolder()` - Folder selection dialog
  - `selectFiles(options)` - File selection with parsing
  - `scanFiles(folderPath)` - Manual folder scan
  - `saveOutput(data)` - Export to file

### Renderer Process (renderer.js, index.html)

The renderer process handles the UI logic:
- Configuration management
- File table display with inline editing
- Lua preview generation
- Validation and status tracking
- User interactions
- Uses Tailwind CSS and DaisyUI for styling

### Steam Modules (src/steam/)

- **library-discovery.js**: Platform-specific Steam installation discovery
- **depot-scanner.js**: Manifest file scanning and app-depot mapping

### Parser Module (src/parsers/)

- **vdf-parser.js**: Minimal VDF/ACF parser with depot and DLC extraction

## Security

This application follows Electron security best practices:
- **Context Isolation**: Enabled to prevent the renderer from accessing Node.js APIs directly
- **Node Integration**: Disabled in the renderer process
- **Preload Script**: Uses `contextBridge` to expose only necessary APIs

## Customization

### Tailwind CSS

Edit `src/styles.css` to add custom CSS or Tailwind utilities.

### DaisyUI Themes

The application supports multiple DaisyUI themes. Edit `tailwind.config.js` to customize available themes:

```javascript
daisyui: {
  themes: ["light", "dark", "cupcake"],
}
```

### Window Configuration

Modify window properties in `main.js`:

```javascript
const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  // Add more options here
});
```

## Requirements

- Node.js 18 or higher
- npm 8 or higher

## License

MIT
