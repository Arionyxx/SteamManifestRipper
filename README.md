# Electron App

An Electron 30 application with Tailwind CSS and DaisyUI styling, targeting Node.js 18.

## Features

- **Electron 30**: Modern desktop application framework
- **Node.js 18**: Long-term support version
- **Tailwind CSS**: Utility-first CSS framework
- **DaisyUI**: Component library built on Tailwind CSS
- **Context Isolation**: Secure preload script setup

## Project Structure

```
.
├── main.js              # Main process (Electron entry point)
├── preload.js           # Preload script with contextBridge
├── renderer.js          # Renderer process logic
├── index.html           # Application UI
├── package.json         # Project dependencies and scripts
├── tailwind.config.js   # Tailwind CSS configuration
├── src/
│   ├── styles.css       # Tailwind CSS entry point
│   └── output.css       # Generated CSS (do not edit)
└── README.md            # This file
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

## Architecture

### Main Process (main.js)

The main process creates and manages the application window. It:
- Creates a BrowserWindow with 1200x800 dimensions
- Enables context isolation for security
- Loads the preload script before the renderer
- Handles application lifecycle events

### Preload Script (preload.js)

The preload script bridges the main and renderer processes securely using `contextBridge`. It exposes:
- Platform information
- Node.js, Chrome, and Electron version information

### Renderer Process (renderer.js, index.html)

The renderer process handles the UI logic:
- Displays version information from the preload script
- Handles user interactions
- Uses Tailwind CSS and DaisyUI for styling

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
