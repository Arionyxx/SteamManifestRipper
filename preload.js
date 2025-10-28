const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  pathSep: path.sep,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  writeFiles: (filesData) => ipcRenderer.invoke('files:write', filesData)
});
