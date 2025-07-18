// electron/popup-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popupAPI', {
  submitStatus: (status) => ipcRenderer.send('submit-status', status),
});
