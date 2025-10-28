const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  loadAppData: (options) => ipcRenderer.invoke('steam:loadAppData', options),
  copyManifests: (options) => ipcRenderer.invoke('steam:copyManifests', options),
  saveOutput: (data) => ipcRenderer.invoke('save:output', data),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings)
});
