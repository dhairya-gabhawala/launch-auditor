const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launchAuditor', {
  openAbout: () => ipcRenderer.send('open-about')
});
