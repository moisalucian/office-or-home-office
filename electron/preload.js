const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendNotificationPopup: () => ipcRenderer.send('show-notification-popup'),
  onPopupStatus: (callback) => ipcRenderer.on('popup-status', (_, status) => callback(status)),
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  setStartup: (enabled) => ipcRenderer.send('set-startup', enabled)
});
