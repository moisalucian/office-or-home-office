const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendNotificationPopup: () => ipcRenderer.send('show-notification-popup'),
  onPopupStatus: (callback) => ipcRenderer.on('popup-status', (_, status) => callback(status)),
  removeAllPopupStatusListeners: () => ipcRenderer.removeAllListeners('popup-status'),
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  setStartup: (enabled) => ipcRenderer.send('set-startup', enabled),
  onWindowStateChanged: (callback) => ipcRenderer.on('window-state-changed', (_, state) => callback(state)),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  toggleSidebarWindow: (show) => ipcRenderer.send('toggle-sidebar-window', show),
  onSidebarWindowClosed: (callback) => ipcRenderer.on('sidebar-window-closed', () => callback()),
  refreshSidebarActivityLogs: () => ipcRenderer.send('refresh-sidebar-activity-logs'),
  onRefreshActivityLogs: (callback) => ipcRenderer.on('refresh-activity-logs', () => callback()),
  
  // New settings APIs
  getSetting: (key, defaultValue) => ipcRenderer.invoke('get-setting', key, defaultValue),
  setLaunchInTray: (enabled) => ipcRenderer.send('set-launch-in-tray', enabled),
  setDefaultLaunchOption: (option) => ipcRenderer.send('set-default-launch-option', option),
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onGetSettingsForTrayLaunch: (callback) => ipcRenderer.on('get-settings-for-tray-launch', () => callback()),
  sendTrayLaunchSettings: (settings) => ipcRenderer.send('tray-launch-settings', settings),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_, theme) => callback(theme)),
  
  // Notification sound APIs
  setNotificationSound: (sound) => ipcRenderer.send('set-notification-sound', sound),
  previewNotificationSound: (sound) => ipcRenderer.send('preview-notification-sound', sound),
  onSoundError: (callback) => ipcRenderer.on('sound-error', (_, message) => callback(message)),
  
  // Auto-update APIs
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  downloadAndInstallUpdate: (downloadUrl) => ipcRenderer.invoke('download-and-install-update', downloadUrl),
  extractAndInstallUpdate: (filePath, version) => ipcRenderer.invoke('extract-and-install-update', filePath, version),
  cancelUpdate: () => ipcRenderer.invoke('cancel-update'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  markUpdateCompleted: (version) => ipcRenderer.invoke('mark-update-completed', version),
  checkUpdateState: () => ipcRenderer.invoke('check-update-state'),
  clearUpdateProgress: () => ipcRenderer.invoke('clear-update-progress'),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (_, progress) => callback(progress)),
  onUpdateInstallProgress: (callback) => ipcRenderer.on('update-install-progress', (_, progress) => callback(progress)),
  
  // Firebase configuration APIs
  getFirebaseConfig: () => ipcRenderer.invoke('get-firebase-config'),
  saveFirebaseConfig: (config) => ipcRenderer.invoke('save-firebase-config', config)
});
