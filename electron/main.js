const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeTheme, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const isHiddenLaunch = process.argv.includes('--hidden');

let popupWindowRef = null;
let sidebarWindowRef = null;
let tray = null;
let win;
let windowState = { maximized: false, sidebarWasOpen: false };

// Simple settings storage using JSON file
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function getSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (error) {
    // Silently handle errors and return empty settings
  }
  return {}; // Return empty object if file doesn't exist or error
}

function saveSetting(key, value) {
  try {
    const settings = getSettings();
    settings[key] = value;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    // Silently handle errors
  }
}

// Auto-updater setup - only check for updates on app start in packaged builds
if (app.isPackaged) {
  autoUpdater.checkForUpdatesAndNotify();

  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Update not available. Current version:', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `[AutoUpdater] Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    console.log(logMessage);
    
    // Send progress to renderer if window exists
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    
    // Show dialog asking user to restart
    const dialogOpts = {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      title: 'Application Update',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart the application to apply the update.'
    };

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
}

// IPC handlers for manual update checks
ipcMain.handle('check-for-updates', async () => {
  if (app.isPackaged) {
    return autoUpdater.checkForUpdatesAndNotify();
  }
  return { message: 'Updates only work in packaged app' };
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

function createWindow(shouldShow = true, shouldMaximize = false) {
  const iconPath = path.join(__dirname, 'icon.ico');
  const distPath = app.isPackaged ? path.join(__dirname, 'dist') : path.join(__dirname, 'dist');
  
  win = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    icon: iconPath,
    show: shouldShow,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (app.isPackaged) {
    win.loadFile(path.join(distPath, 'index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }

  if (shouldMaximize && shouldShow) {
    win.maximize();
    windowState.maximized = true;
  }

  win.on('close', (event) => {
    const settings = getSettings();
    const closeToTray = settings.closeToTray !== undefined ? settings.closeToTray : true;
    
    if (closeToTray) {
      event.preventDefault();
      win.hide();
      windowState.maximized = win.isMaximized();
    }
  });

  win.on('closed', () => {
    win = null;
  });

  win.on('maximize', () => {
    windowState.maximized = true;
  });

  win.on('unmaximize', () => {
    windowState.maximized = false;
  });
}

function createSidebarWindow() {
  if (sidebarWindowRef && !sidebarWindowRef.isDestroyed()) {
    return;
  }

  const iconPath = path.join(__dirname, 'icon.ico');
  const distPath = app.isPackaged ? path.join(__dirname, 'dist') : path.join(__dirname, 'dist');

  sidebarWindowRef = new BrowserWindow({
    width: 300,
    height: 600,
    icon: iconPath,
    show: false,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (app.isPackaged) {
    sidebarWindowRef.loadFile(path.join(distPath, 'index.html'));
  } else {
    sidebarWindowRef.loadURL('http://localhost:5173');
  }

  sidebarWindowRef.webContents.once('dom-ready', () => {
    sidebarWindowRef.webContents.send('set-sidebar-mode', true);
  });

  sidebarWindowRef.on('blur', () => {
    setTimeout(() => {
      if (sidebarWindowRef && !sidebarWindowRef.isDestroyed() && sidebarWindowRef.isVisible()) {
        sidebarWindowRef.hide();
        windowState.sidebarWasOpen = false;
      }
    }, 100);
  });

  sidebarWindowRef.on('closed', () => {
    sidebarWindowRef = null;
    windowState.sidebarWasOpen = false;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.ico');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        if (win) {
          win.show();
          if (windowState.maximized) {
            win.maximize();
          }
        }
      }
    },
    {
      label: 'Hide',
      click: () => {
        if (win) {
          windowState.maximized = win.isMaximized();
          win.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        if (app.isPackaged) {
          autoUpdater.checkForUpdatesAndNotify();
        } else {
          console.log('Updates only work in packaged app');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Office or Home Office');

  tray.on('double-click', () => {
    if (win) {
      if (win.isVisible()) {
        windowState.maximized = win.isMaximized();
        win.hide();
      } else {
        win.show();
        if (windowState.maximized) {
          win.maximize();
        }
      }
    }
  });
}

// IPC handlers
ipcMain.handle('get-setting', (event, key) => {
  const settings = getSettings();
  return settings[key];
});

ipcMain.handle('save-setting', (event, key, value) => {
  saveSetting(key, value);
  return true;
});

ipcMain.handle('get-all-settings', () => {
  return getSettings();
});

ipcMain.handle('minimize-window', () => {
  if (win) {
    win.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (win) {
    win.close();
  }
});

ipcMain.handle('toggle-sidebar', () => {
  if (!sidebarWindowRef || sidebarWindowRef.isDestroyed()) {
    createSidebarWindow();
  }

  if (sidebarWindowRef.isVisible()) {
    sidebarWindowRef.hide();
    windowState.sidebarWasOpen = false;
  } else {
    const cursorPos = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPos);
    
    const x = display.bounds.x + display.bounds.width - 320;
    const y = display.bounds.y + 50;
    
    sidebarWindowRef.setPosition(x, y);
    sidebarWindowRef.show();
    windowState.sidebarWasOpen = true;
  }
});

ipcMain.handle('show-notification-popup', (event, message) => {
  if (popupWindowRef && !popupWindowRef.isDestroyed()) {
    popupWindowRef.close();
  }

  const iconPath = path.join(__dirname, 'icon.ico');
  
  popupWindowRef = new BrowserWindow({
    width: 300,
    height: 100,
    icon: iconPath,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'popup-preload.js')
    }
  });

  popupWindowRef.loadFile(path.join(__dirname, 'popup.html'));
  
  popupWindowRef.webContents.once('dom-ready', () => {
    popupWindowRef.webContents.send('show-message', message);
    
    const cursorPos = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPos);
    
    const x = display.bounds.x + display.bounds.width - 320;
    const y = display.bounds.y + 50;
    
    popupWindowRef.setPosition(x, y);
    popupWindowRef.show();
    
    setTimeout(() => {
      if (popupWindowRef && !popupWindowRef.isDestroyed()) {
        popupWindowRef.close();
      }
    }, 3000);
  });

  popupWindowRef.on('closed', () => {
    popupWindowRef = null;
  });
});

app.whenReady().then(async () => {
  console.log('[App] Starting app, version:', require('../package.json').version);
  
  // Get launch settings from storage to determine how to open the app
  const settings = getSettings();
  const launchInTray = settings.launchInTray || false;
  const defaultLaunchOption = settings.defaultLaunchOption || 'normal';
  
  // Startup setting handling
  const startupSetting = settings.startup !== undefined ? settings.startup : true;
  if (settings.startup === undefined) {
    saveSetting('startup', true);
  }
  
  // Apply startup setting to system
  app.setLoginItemSettings({
    openAtLogin: startupSetting,
    path: process.execPath,
    args: app.isPackaged ? ['--hidden'] : []
  });
  
  // Determine how to create the window based on settings
  const shouldShow = !launchInTray && !isHiddenLaunch;
  const shouldMaximize = defaultLaunchOption === 'maximized';
  
  createWindow(shouldShow, shouldMaximize);
  createTray();
  
  // Pre-create satellite window for instant showing
  setTimeout(() => {
    createSidebarWindow();
  }, 500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const shouldShow = !launchInTray;
      const shouldMaximize = defaultLaunchOption === 'maximized';
      createWindow(shouldShow, shouldMaximize);
    }
  });
});

app.on('before-quit', () => {
  app.isQuiting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
  
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});
