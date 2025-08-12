const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeTheme, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');
const os = require('os');
const isHiddenLaunch = process.argv.includes('--hidden');

let popupWindowRef = null;
let sidebarWindowRef = null;
let tray = null;
let win;
let windowState = { maximized: false }; // Track window state for tray double-click

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

// Auto-update functionality
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

async function extractAndInstallUpdate(filePath) {
  return new Promise((resolve, reject) => {
    const extractPath = path.join(os.tmpdir(), 'office-home-office-update');
    
    // For Windows, we expect a zip file or installer
    if (path.extname(filePath) === '.exe') {
      // If it's an installer, run it
      exec(`"${filePath}" /S`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    } else if (path.extname(filePath) === '.zip') {
      // If it's a zip file, extract and replace current files
      const AdmZip = require('adm-zip');
      try {
        const zip = new AdmZip(filePath);
        zip.extractAllTo(extractPath, true);
        
        // Copy extracted files to app directory
        const appPath = app.getAppPath();
        copyRecursiveSync(extractPath, appPath);
        resolve();
      } catch (error) {
        reject(error);
      }
    } else {
      reject(new Error('Unsupported file format'));
    }
  });
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

let updateSidebarPosition; // Store reference to the listener function

function createSidebarWindow() {
  if (sidebarWindowRef && !sidebarWindowRef.isDestroyed()) {
    return; // Already exists
  }

  // Don't create sidebar if main window is being destroyed
  if (!win || win.isDestroyed()) {
    return;
  }

  const mainBounds = win.getBounds();
  
  sidebarWindowRef = new BrowserWindow({
    width: 450,
    height: mainBounds.height,
    x: mainBounds.x - 455, // Adjusted gap to 5px from main window (450 + 5)
    y: mainBounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false,
    skipTaskbar: true,
    parent: win, // Make it a child of main window
    show: false, // Start hidden for instant showing later
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the sidebar content
  if (process.env.NODE_ENV === 'development') {
    sidebarWindowRef.loadURL('http://localhost:5173#sidebar');
  } else {
    // For production builds - same as main window
    const indexPath = path.join(__dirname, '../react-ui/dist/index.html');
    
    if (fs.existsSync(indexPath)) {
      sidebarWindowRef.loadFile(indexPath, { hash: 'sidebar' });
    } else {
      console.error('Index.html not found for sidebar at:', indexPath);
    }
  }

  // Remove previous listeners if they exist
  if (updateSidebarPosition) {
    win.removeListener('move', updateSidebarPosition);
    win.removeListener('resize', updateSidebarPosition);
  }

  // Track main window position changes
  updateSidebarPosition = () => {
    if (sidebarWindowRef && !sidebarWindowRef.isDestroyed() && win && !win.isDestroyed()) {
      const mainBounds = win.getBounds();
      sidebarWindowRef.setBounds({
        x: mainBounds.x - 455, // Keep 5px gap on the LEFT side (450 + 5)
        y: mainBounds.y,
        width: 450,
        height: mainBounds.height
      });
    }
  };

  win.on('move', updateSidebarPosition);
  win.on('resize', updateSidebarPosition);

  sidebarWindowRef.on('closed', () => {
    // Clean up listeners when sidebar window is closed
    if (updateSidebarPosition) {
      win.removeListener('move', updateSidebarPosition);
      win.removeListener('resize', updateSidebarPosition);
      updateSidebarPosition = null;
    }
    
    sidebarWindowRef = null;
    // Notify main window that sidebar was closed ONLY if main window still exists and is not being destroyed
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send('sidebar-window-closed');
    }
  });
}

function createWindow(shouldShow = true, shouldMaximize = false) {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const maxHeight = Math.floor(screenHeight * 0.9);

  win = new BrowserWindow({
    width: 940,
    height: 650, 
    show: false, // Always start hidden, then show explicitly
    frame: false, // Restore frameless window
    transparent: true, // Restore transparency
    resizable: true,
    autoHideMenuBar: true,
    roundedCorners: true, // Enable rounded corners on the window itself
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    // For production builds
    const indexPath = path.join(__dirname, '../react-ui/dist/index.html');
    console.log('Loading from:', indexPath);
    console.log('File exists:', fs.existsSync(indexPath));
    
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath);
    } else {
      console.error('Index.html not found at:', indexPath);
      // Try alternative approach with URL
      const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;
      console.log('Trying file URL:', fileUrl);
      win.loadURL(fileUrl).catch(error => {
        dialog.showErrorBox(
          'Application Load Error',
          `Cannot load application: ${error.message}`
        );
      });
    }
  }

  // Add event listeners
  win.webContents.on('dom-ready', () => {
    // DOM is ready
  });

  // Wait for content to load, then show the window
  win.webContents.once('did-finish-load', () => {
    console.log('Window content finished loading');
    
    if (shouldShow && !isHiddenLaunch) {
      win.show();
      win.focus();
    }
    
    // Maximize if requested
    if (shouldMaximize) {
      win.maximize();
      windowState.maximized = true;
    }
  });

  // Add error handling
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load window content:', errorCode, errorDescription);
    
    // Try to show a basic error dialog if the window fails to load
    dialog.showErrorBox(
      'Application Load Error',
      `Failed to load application content.\nError: ${errorDescription}\nCode: ${errorCode}`
    );
  });

  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide(); // 🔒 hide instead of closing
    } else {
      // If app is actually quitting, clean up sidebar first
      if (sidebarWindowRef && !sidebarWindowRef.isDestroyed()) {
        sidebarWindowRef.destroy(); // Force destroy sidebar without trying to communicate back
        sidebarWindowRef = null;
      }
    }
  });

  // Handle window maximize/unmaximize events
  win.on('maximize', () => {
    windowState.maximized = true;
    
    // Close sidebar window before maximizing and clean up listeners
    if (sidebarWindowRef && !sidebarWindowRef.isDestroyed()) {
      if (updateSidebarPosition) {
        win.removeListener('move', updateSidebarPosition);
        win.removeListener('resize', updateSidebarPosition);
        updateSidebarPosition = null;
      }
      
      sidebarWindowRef.close();
      sidebarWindowRef = null;
    }
    
    win.setResizable(false);
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('window-state-changed', { maximized: true });
    }
  });

  win.on('unmaximize', () => {
    windowState.maximized = false;
    win.setResizable(true);
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('window-state-changed', { maximized: false });
    }
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.ico'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        if (win && !win.isDestroyed()) {
          win.show();
          win.focus();
          if (win.isMinimized()) win.restore();
        }
      }
    },
    {
      label: 'Exit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Office Or Home Office');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
      if (win.isMinimized()) win.restore();
      
      // Only send IPC message if webContents is ready
      if (win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('get-settings-for-tray-launch');
      }
    }
  });
}

app.whenReady().then(() => {
  // Get launch settings from storage to determine how to open the app
  const settings = getSettings();
  const launchInTray = settings.launchInTray || false;
  const defaultLaunchOption = settings.defaultLaunchOption || 'window';
  
  // Set default startup setting if not already configured
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
  // Wait a bit for main window to be ready
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

// 🔔 Deschidere popup
ipcMain.on('show-notification-popup', () => {
  // Play notification sound if enabled
  const settings = getSettings();
  const notificationSound = settings.notificationSound || 'none';
  
  if (notificationSound !== 'none') {
    const soundPath = path.join(__dirname, 'sounds', `${notificationSound}.wav`);
    if (fs.existsSync(soundPath)) {
      const command = `powershell -c "(New-Object Media.SoundPlayer '${soundPath}').PlaySync();"`;
      
      exec(command, (error) => {
        if (error) {
          // Fallback to default player
          const altCommand = `start "" "${soundPath}"`;
          exec(altCommand, () => {});
        }
      });
    }
  }

  popupWindowRef = new BrowserWindow({
    width: 550,
    height: 275,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'popup-preload.js'),
    },
  });

  popupWindowRef.loadFile(path.join(__dirname, 'popup.html'));
});

// ✅ Receive response from popup
ipcMain.on('submit-status', (_, status) => {
  if (win && !win.isDestroyed() && win.webContents) {
    win.webContents.send('popup-status', status);
  }

  if (popupWindowRef) {
    popupWindowRef.close();
    popupWindowRef = null;
  }
});

// ✅ Window control
ipcMain.on('minimize-window', () => {
  if (win) win.minimize();
});
ipcMain.on('maximize-window', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
      // Re-enable resizing when unmaximized
      win.setResizable(true);
      // Send event to remove fullscreen styling
      if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('window-state-changed', { maximized: false });
      }
    } else {
      // Close sidebar window before maximizing to prevent conflicts
      if (sidebarWindowRef && !sidebarWindowRef.isDestroyed()) {
        if (updateSidebarPosition) {
          win.removeListener('move', updateSidebarPosition);
          win.removeListener('resize', updateSidebarPosition);
          updateSidebarPosition = null;
        }
        
        sidebarWindowRef.close();
        sidebarWindowRef = null;
      }
      
      win.maximize();
      // Disable resizing when maximized
      win.setResizable(false);
      // Send event to apply fullscreen styling
      if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('window-state-changed', { maximized: true });
      }
    }
  }
});
ipcMain.on('close-window', () => {
  if (win) win.close(); // will be intercepted and just hidden
});

ipcMain.on('resize-window', (_, width, height) => {
  if (win && !win.isMaximized()) {
    win.setSize(width, height);
    // Removed win.center() to preserve user's window position
  }
});

// Get settings from main process
ipcMain.handle('get-setting', (_, key, defaultValue) => {
  const settings = getSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
});

// ✅ Setare startup
ipcMain.on('set-startup', (_, shouldLaunchAtStartup) => {
  // Save to settings file for persistence
  saveSetting('startup', shouldLaunchAtStartup);
  
  // Apply to system startup
  app.setLoginItemSettings({
    openAtLogin: shouldLaunchAtStartup,
    path: process.execPath,
    args: app.isPackaged ? ['--hidden'] : []
  });
});

// Settings management with electron-store
// Handle tray launch settings
ipcMain.on('set-launch-in-tray', (_, shouldLaunchInTray) => {
  saveSetting('launchInTray', shouldLaunchInTray);
});

// Handle default launch option
ipcMain.on('set-default-launch-option', (_, option) => {
  saveSetting('defaultLaunchOption', option);
});

// Handle theme setting
ipcMain.on('set-theme', (_, theme) => {
  saveSetting('theme', theme);
  applyTheme(theme);
});

// Handle notification sound setting
ipcMain.on('set-notification-sound', (_, sound) => {
  saveSetting('notificationSound', sound);
});

// Preview notification sound
ipcMain.on('preview-notification-sound', (_, sound) => {
  if (sound !== 'none') {
    const soundPath = path.join(__dirname, 'sounds', `${sound}.wav`);
    
    if (fs.existsSync(soundPath)) {
      // Use PowerShell to play the sound
      const command = `powershell -c "(New-Object Media.SoundPlayer '${soundPath}').PlaySync();"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Fallback to default player
          const altCommand = `start "" "${soundPath}"`;
          exec(altCommand, (altError) => {
            if (altError) {
              // Final fallback to web audio in main window
              if (win && !win.isDestroyed()) {
                win.webContents.executeJavaScript(`
                  (function() {
                    try {
                      const existingAudio = document.getElementById('preview-audio');
                      if (existingAudio) {
                        existingAudio.remove();
                      }
                      
                      const audio = document.createElement('audio');
                      audio.id = 'preview-audio';
                      audio.volume = 1.0;
                      audio.src = 'file:///${soundPath.replace(/\\/g, '/')}';
                      document.body.appendChild(audio);
                      
                      audio.play().catch(() => {});
                      
                      audio.onended = () => {
                        audio.remove();
                      };
                      
                      setTimeout(() => {
                        if (document.getElementById('preview-audio')) {
                          document.getElementById('preview-audio').remove();
                        }
                      }, 10000);
                    } catch (err) {}
                  })();
                `).catch(() => {});
              }
            }
          });
        }
      });
    } else {
      // Send error message to renderer only if file not found
      if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('sound-error', `Sound file not found: ${sound}.wav`);
      }
    }
  }
});

// Get current system theme preference
ipcMain.handle('get-system-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

// Get app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Download and install update
ipcMain.handle('download-and-install-update', async (_, downloadUrl) => {
  try {
    const fileName = path.basename(downloadUrl);
    const tempPath = path.join(os.tmpdir(), fileName);
    
    // Download the update file
    await downloadFile(downloadUrl, tempPath);
    
    // Return success without showing dialog - let the UI handle the restart prompt
    return { success: true, filePath: tempPath };
  } catch (error) {
    console.error('Update download failed:', error);
    throw error;
  }
});

// Restart the application
ipcMain.handle('restart-app', () => {
  app.relaunch({ args: ['--updated'] });
  app.quit();
});

// Handle update completion state
ipcMain.handle('mark-update-completed', (event, version) => {
  // Store update completion in app data
  const fs = require('fs');
  const path = require('path');
  const userDataPath = app.getPath('userData');
  const updateStateFile = path.join(userDataPath, 'update-state.json');
  
  const updateState = {
    completed: true,
    version: version,
    timestamp: Date.now()
  };
  
  try {
    fs.writeFileSync(updateStateFile, JSON.stringify(updateState, null, 2));
  } catch (error) {
    console.error('Failed to save update state:', error);
  }
});

// Check if app was restarted after update
ipcMain.handle('check-update-state', () => {
  const fs = require('fs');
  const path = require('path');
  const userDataPath = app.getPath('userData');
  const updateStateFile = path.join(userDataPath, 'update-state.json');
  
  try {
    if (fs.existsSync(updateStateFile)) {
      const updateState = JSON.parse(fs.readFileSync(updateStateFile, 'utf8'));
      // Clear the state file after reading
      fs.unlinkSync(updateStateFile);
      return updateState;
    }
  } catch (error) {
    console.error('Failed to read update state:', error);
  }
  
  return null;
});

// Clear update progress on app restart
ipcMain.handle('clear-update-progress', () => {
  // This will be called on app startup to ensure clean state
  return true;
});

// Apply theme based on setting
function applyTheme(themeSetting) {
  switch (themeSetting) {
    case 'dark':
      nativeTheme.themeSource = 'dark';
      break;
    case 'light':
      nativeTheme.themeSource = 'light';
      break;
    case 'system':
    default:
      nativeTheme.themeSource = 'system';
      break;
  }
  
  // Send theme update to main window
  if (win && !win.isDestroyed() && win.webContents) {
    const currentTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    win.webContents.send('theme-changed', currentTheme);
  }
  
  // Send theme update to sidebar window
  if (sidebarWindowRef && !sidebarWindowRef.isDestroyed() && sidebarWindowRef.webContents) {
    const currentTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    sidebarWindowRef.webContents.send('theme-changed', currentTheme);
  }
}

// Handle tray double-click with proper settings
ipcMain.on('tray-launch-settings', (_, settings) => {
  const { defaultLaunchOption } = settings;
  
  if (win) {
    win.show();
    
    // Apply the default launch option based on settings or preserve current state
    if (defaultLaunchOption === 'maximized' || windowState.maximized) {
      if (!win.isMaximized()) {
        win.maximize();
      }
    } else {
      if (win.isMaximized()) {
        win.unmaximize();
      }
    }
  }
});

// Sidebar window management
ipcMain.on('toggle-sidebar-window', (_, show) => {
  if (show) {
    // Create if doesn't exist, otherwise just show
    if (!sidebarWindowRef || sidebarWindowRef.isDestroyed()) {
      createSidebarWindow();
    }
    
    if (sidebarWindowRef && !sidebarWindowRef.isDestroyed()) {
      // Update position before showing
      const mainBounds = win.getBounds();
      sidebarWindowRef.setBounds({
        x: mainBounds.x - 455,
        y: mainBounds.y,
        width: 450,
        height: mainBounds.height
      });
      sidebarWindowRef.show();
    }
  } else {
    if (sidebarWindowRef && !sidebarWindowRef.isDestroyed()) {
      sidebarWindowRef.hide(); // Hide instead of closing
    }
  }
});

// Refresh activity logs in sidebar window
ipcMain.on('refresh-sidebar-activity-logs', () => {
  if (sidebarWindowRef && !sidebarWindowRef.isDestroyed() && sidebarWindowRef.webContents) {
    sidebarWindowRef.webContents.send('refresh-activity-logs');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
