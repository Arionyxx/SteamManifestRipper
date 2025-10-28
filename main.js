const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { loadAppData } = require('./src/steam/app-loader');
const { copyManifests } = require('./src/steam/manifest-copier');
const { SettingsStore } = require('./src/main/settings-store');

let settingsStore;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('steam:loadAppData', async (event, options = {}) => {
  try {
    const result = await loadAppData(options);
    return result;
  } catch (error) {
    return {
      success: false,
      appId: options.appId || '',
      appName: '',
      depots: [],
      missingKeys: [],
      errors: [error.message],
      warnings: []
    };
  }
});

ipcMain.handle('steam:copyManifests', async (event, options = {}) => {
  try {
    // Set default output directory if not provided
    const outputDir = options.destination || path.join(app.getPath('userData'), 'output');
    
    const result = await copyManifests({
      ...options,
      destination: outputDir,
      organizeByAppId: true  // Always organize by AppID
    });
    
    return result;
  } catch (error) {
    return {
      success: false,
      copied: [],
      missing: [],
      errors: [error.message]
    };
  }
});

ipcMain.handle('save:output', async (event, data) => {
  try {
    // Determine output directory
    const baseOutputDir = data.outputFolder || path.join(app.getPath('userData'), 'output');
    
    // If AppID is provided, create AppID subfolder
    let outputDir = baseOutputDir;
    if (data.appId) {
      outputDir = path.join(baseOutputDir, data.appId.toString());
    }
    
    // Ensure directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Build full output path
    const filename = data.filename || 'output.lua';
    const outputPath = path.join(outputDir, filename);
    
    // Save file directly without dialog
    if (data.autoSave !== false) {
      await fs.writeFile(outputPath, data.content, 'utf8');
      return { success: true, path: outputPath };
    }
    
    // Show save dialog if autoSave is explicitly disabled
    const result = await dialog.showSaveDialog({
      defaultPath: outputPath,
      filters: [
        { name: 'Lua Files', extensions: ['lua'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      await fs.writeFile(result.filePath, data.content, 'utf8');
      return { success: true, path: result.filePath };
    }
    
    return { success: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save:outputWithDialog', async (event, data) => {
  try {
    const baseOutputDir = data.outputFolder || path.join(app.getPath('userData'), 'output');
    let defaultPath = baseOutputDir;
    
    // If AppID provided, set default to AppID subfolder
    if (data.appId) {
      defaultPath = path.join(baseOutputDir, data.appId.toString());
      await fs.mkdir(defaultPath, { recursive: true });
    }
    
    const filename = data.filename || 'output.lua';
    defaultPath = path.join(defaultPath, filename);
    
    const result = await dialog.showSaveDialog({
      defaultPath: defaultPath,
      filters: [
        { name: 'Lua Files', extensions: ['lua'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      await fs.writeFile(result.filePath, data.content, 'utf8');
      return { success: true, path: result.filePath };
    }
    return { success: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:ensureDirectory', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true, path: dirPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:getOutputPath', async (event, appId = null) => {
  const baseOutputDir = path.join(app.getPath('userData'), 'output');
  
  if (appId) {
    return path.join(baseOutputDir, appId.toString());
  }
  
  return baseOutputDir;
});

ipcMain.handle('settings:load', async () => {
  return await settingsStore.load();
});

ipcMain.handle('settings:save', async (event, settings) => {
  return await settingsStore.save(settings);
});

app.whenReady().then(() => {
  settingsStore = new SettingsStore(app);
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
