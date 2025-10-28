const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { loadAppData } = require('./src/steam/app-loader');
const { copyManifests } = require('./src/steam/manifest-copier');

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
    const result = await copyManifests(options);
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
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(data.outputFolder || '', data.filename || 'output.lua'),
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
