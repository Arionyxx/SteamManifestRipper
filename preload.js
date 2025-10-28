const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  scanFiles: (folderPath) => ipcRenderer.invoke('scan:files', folderPath),
  selectFiles: (options) => ipcRenderer.invoke('dialog:selectFiles', options),
  scanDepotcache: (options) => ipcRenderer.invoke('steam:scanDepotcache', options),
  saveOutput: (data) => ipcRenderer.invoke('save:output', data)
});
