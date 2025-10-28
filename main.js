const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

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

ipcMain.handle('dialog:selectFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Manifest Files', extensions: ['manifest', 'vdf', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const files = result.filePaths.map(filePath => ({
      path: filePath,
      name: path.basename(filePath),
      manifestId: '',
      depotId: '',
      appId: '',
      type: path.extname(filePath).substring(1) || 'unknown',
      status: 'pending'
    }));
    return { success: true, files };
  }
  return { success: false };
});

ipcMain.handle('scan:files', async (event, folderPath) => {
  try {
    const files = await fs.readdir(folderPath);
    const manifestFiles = files.filter(file => 
      file.endsWith('.manifest') || file.endsWith('.vdf') || file.endsWith('.txt')
    );
    
    const fileData = manifestFiles.map(file => ({
      path: path.join(folderPath, file),
      name: file,
      manifestId: extractManifestId(file),
      depotId: extractDepotId(file),
      appId: '',
      type: path.extname(file).substring(1) || 'unknown',
      status: 'pending'
    }));
    
    return { success: true, files: fileData };
  } catch (error) {
    return { success: false, error: error.message };
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

function extractManifestId(filename) {
  const match = filename.match(/(\d+)\.manifest/);
  return match ? match[1] : '';
}

function extractDepotId(filename) {
  const match = filename.match(/depot[_-]?(\d+)/i);
  return match ? match[1] : '';
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
