const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeTheme, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');
const os = require('os');

// Update install timeout constant (3 minutes)
const UPDATE_INSTALL_TIMEOUT = 3 * 60 * 1000; // 3 minutes

// Global download tracking for cancellation
let currentDownload = null;

const isHiddenLaunch = process.argv.includes('--hidden');

let popupWindowRef = null;
let sidebarWindowRef = null;
let tray = null;
let win;
let windowState = { maximized: false, sidebarWasOpen: false }; // Track window state for tray double-click

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

// Auto-update functionality (CUSTOM SYSTEM)


async function downloadFile(url, dest, win) {
  return new Promise((resolve, reject) => {
    // Clean up any previous file
    try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch (e) {}

    const tempDest = dest + '.download';
    try { if (fs.existsSync(tempDest)) fs.unlinkSync(tempDest); } catch (e) {}

    const file = fs.createWriteStream(tempDest);
    let downloadError = null;
    let total = 0;
    let downloaded = 0;
    let cancelled = false;

    const request = https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        return downloadFile(response.headers.location, dest, win).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP Status ${response.statusCode}`));
        return;
      }

      total = parseInt(response.headers['content-length'], 10) || 0;

      // Store download context for cancellation
      currentDownload = {
        request,
        response,
        file,
        tempDest,
        cancel: () => {
          cancelled = true;
          request.destroy();
          response.destroy();
          file.destroy();
          try { fs.unlinkSync(tempDest); } catch (e) {}
          reject(new Error('Download cancelled by user'));
        }
      };

      response.on('data', (chunk) => {
        if (cancelled) return;
        
        downloaded += chunk.length;
        if (win && win.webContents) {
          const downloadedMB = (downloaded / 1024 / 1024).toFixed(1);
          const totalMB = total ? (total / 1024 / 1024).toFixed(1) : '?';
          win.webContents.send('update-download-progress', {
            percent: total ? Math.round((downloaded / total) * 100) : 0,
            downloaded: downloadedMB,
            total: totalMB
          });
        }
      });

      response.pipe(file);
    });

    file.on('error', (err) => {
      downloadError = err;
      currentDownload = null; // Clear download tracking
      try { fs.unlinkSync(tempDest); } catch (e) {}
      reject(err);
    });

    request.on('error', (err) => {
      downloadError = err;
      currentDownload = null; // Clear download tracking
      try { fs.unlinkSync(tempDest); } catch (e) {}
      reject(err);
    });

    file.on('finish', () => {
      file.close((closeErr) => {
        if (closeErr) {
          downloadError = closeErr;
          try { fs.unlinkSync(tempDest); } catch (e) {}
          reject(closeErr);
          return;
        }
        // Check file size and zip integrity
        fs.stat(tempDest, (statErr, stats) => {
          if (statErr) {
            downloadError = statErr;
            try { fs.unlinkSync(tempDest); } catch (e) {}
            reject(statErr);
            return;
          }
          if (total && stats.size !== total) {
            downloadError = new Error(`Downloaded file size mismatch. Expected ${total}, got ${stats.size}.`);
            try { fs.unlinkSync(tempDest); } catch (e) {}
            reject(downloadError);
            return;
          }
          try {
            const AdmZip = require('adm-zip');
            const zipTest = new AdmZip(tempDest);
            const entries = zipTest.getEntries();
            if (entries.length === 0) throw new Error('Downloaded ZIP file is empty or contains no entries.');
            // Move temp file to final destination
            fs.renameSync(tempDest, dest);
            currentDownload = null; // Clear download tracking
            resolve();
          } catch (zipVerifyError) {
            currentDownload = null; // Clear download tracking
            try { fs.unlinkSync(tempDest); } catch (e) {}
            reject(new Error(`Downloaded file verification failed: ${zipVerifyError.message}. The file might be corrupted or incomplete.`));
          }
        });
      });
    });
  });
}

async function extractAndInstallUpdate(filePath, winRef, version) {
  const logFile = path.join(os.tmpdir(), 'update-log.txt');
  
  function writeLog(msg) {
    const line = `[${new Date().toISOString()}] [ExtractInstall] ${msg}`;
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (e) {
      console.error('Failed to write to update-log.txt:', e);
    }
    console.log(line);
  }

  writeLog(`Starting extractAndInstallUpdate with filePath: ${filePath}, version: ${version}`);
  
  return new Promise((resolve, reject) => {
    const extractPath = path.join(os.tmpdir(), 'office-home-office-update');
    writeLog(`Extract path: ${extractPath}`);
    
    // Clean up previous extraction
    try { 
      if (fs.existsSync(extractPath)) {
        writeLog('Cleaning up previous extraction directory');
        fs.rmSync(extractPath, { recursive: true, force: true }); 
      }
    } catch (e) {
      writeLog('Error cleaning up extraction directory: ' + e);
    }

    if (path.extname(filePath) === '.exe') {
      writeLog('Detected .exe installer file');
      if (winRef && winRef.webContents) {
        winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 10, message: 'Running installer...' });
      }
      writeLog(`Executing installer: "${filePath}" /S`);
      exec(`"${filePath}" /S`, (error) => {
        if (error) {
          writeLog('Installer failed: ' + error.message);
          if (winRef && winRef.webContents) {
            winRef.webContents.send('update-install-progress', { phase: 'error', percent: 100, message: `Installer failed: ${error.message}` });
          }
          reject(error);
        } else {
          writeLog('Installer completed successfully');
          if (winRef && winRef.webContents) {
            winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 100, message: 'Install complete.' });
          }
          resolve();
        }
      });
    } else if (path.extname(filePath) === '.zip') {
      writeLog('Detected .zip update file');
      const extract = require('extract-zip');
      if (winRef && winRef.webContents) {
        winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 10, message: 'Extracting update...' });
      }
      
      // Set up timeout
      writeLog(`Setting up extraction timeout: ${UPDATE_INSTALL_TIMEOUT / 1000} seconds`);
      let extractionTimeout = setTimeout(() => {
        writeLog(`Extraction timed out after ${UPDATE_INSTALL_TIMEOUT / 1000} seconds`);
        if (winRef && winRef.webContents) {
          winRef.webContents.send('update-install-progress', { phase: 'error', percent: 20, message: `Extraction timed out after ${UPDATE_INSTALL_TIMEOUT / 1000} seconds.` });
        }
        reject(new Error(`Extraction timed out after ${UPDATE_INSTALL_TIMEOUT / 1000} seconds`));
      }, UPDATE_INSTALL_TIMEOUT);

      (async () => {
        try {
          writeLog('Starting zip extraction process');
          if (winRef && winRef.webContents) {
            winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 15, message: 'Extracting files...' });
          }
          
          // Use AdmZip for better app.asar handling
          writeLog('Using AdmZip for extraction');
          const AdmZip = require('adm-zip');
          const zip = new AdmZip(filePath);
          
          // Manual extraction to handle app.asar file properly
          const entries = zip.getEntries();
          writeLog(`Found ${entries.length} entries in zip file`);
          let extractedCount = 0;
          
          for (const entry of entries) {
            if (!entry.isDirectory) {
              const entryPath = path.join(extractPath, entry.entryName);
              const entryDir = path.dirname(entryPath);
              
              // Create directory if it doesn't exist
              if (!fs.existsSync(entryDir)) {
                fs.mkdirSync(entryDir, { recursive: true });
              }
              
              const fileData = entry.getData();
              
              // Special handling for app.asar - use alternative filename to avoid "Invalid package" error
              if (entry.entryName.includes('app.asar')) {
                // For app.asar files, extract to a completely different extension to avoid Node.js package validation
                const alternativeAsarPath = entryPath.replace('app.asar', 'app.package');
                fs.writeFileSync(alternativeAsarPath, fileData, { encoding: null });
              } else {
                // Normal file extraction
                fs.writeFileSync(entryPath, fileData, { encoding: null });
              }
              
              extractedCount++;
              
              // Update progress every 1000 files to reduce log spam
              if (extractedCount % 1000 === 0) {
                const percent = 15 + Math.floor((extractedCount / entries.length) * 25);
                if (winRef && winRef.webContents) {
                  winRef.webContents.send('update-install-progress', { 
                    phase: 'installing', 
                    percent, 
                    message: `Extracted ${extractedCount}/${entries.length} files...` 
                  });
                }
              }
            } else {
              // Create directory
              const dirPath = path.join(extractPath, entry.entryName);
              if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
              }
            }
          }
          
          clearTimeout(extractionTimeout);
          writeLog('Extraction completed, timeout cleared');
          if (winRef && winRef.webContents) {
            winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 40, message: 'Extraction completed' });
          }
          // Debug: Check if app.asar exists after extraction
          const appAsarPath = path.join(extractPath, 'resources', 'app.asar');
          const appPackagePath = path.join(extractPath, 'resources', 'app.package');
          
          writeLog(`Checking for app.package at: ${appPackagePath}`);
          if (!fs.existsSync(appPackagePath)) {
            writeLog('ERROR: app.package missing after extraction');
            if (winRef && winRef.webContents) {
              winRef.webContents.send('update-install-progress', { phase: 'error', percent: 100, message: `app.package missing after extraction: ${appPackagePath}` });
            }
            reject(new Error(`app.package missing after extraction: ${appPackagePath}`));
            return;
          } else {
            writeLog('app.package found after extraction successfully');
            // For staging, we'll leave it as app.package and rename during startup
            writeLog('Keeping app.package filename for staged update');
          }

          // Instead of copying immediately (which fails during runtime),
          // stage the update for next restart
          writeLog('Staging update for next restart');
          if (winRef && winRef.webContents) {
            winRef.webContents.send('update-install-progress', { 
              phase: 'restart_required', 
              percent: 100, 
              message: 'Update ready - restart to apply' 
            });
          }
          
          // Store the staged update path for startup application
          const stagedUpdateInfo = {
            extractPath: extractPath,
            timestamp: Date.now(),
            version: version || 'unknown'
          };
          
          // Save staged update info to a file
          const stagedUpdateFile = path.join(app.getPath('userData'), 'staged-update.json');
          writeLog(`Saving staged update info to: ${stagedUpdateFile}`);
          fs.writeFileSync(stagedUpdateFile, JSON.stringify(stagedUpdateInfo, null, 2));
          writeLog('Staged update info saved successfully');
          
          resolve('Update staged successfully');
          return;
        } catch (err) {
          clearTimeout(extractionTimeout);
          writeLog('Extraction failed: ' + err.message);
          if (winRef && winRef.webContents) {
            winRef.webContents.send('update-install-progress', { phase: 'error', percent: 20, message: `Extraction failed: ${err.message}` });
          }
          reject(err);
        }
      })();
    } else {
      writeLog('Unsupported file format: ' + path.extname(filePath));
      if (winRef && winRef.webContents) {
        winRef.webContents.send('update-install-progress', { phase: 'error', percent: 100, message: 'Unsupported file format' });
      }
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
    // For production builds - React files are in electron/dist (committed)
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    
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

  // Enable DevTools with F12 only when maximized
  win.webContents.on('before-input-event', (event, input) => {
    if (
      input.type === 'keyDown' &&
      input.key === 'F12' &&
      win.isMaximized()
    ) {
      win.webContents.openDevTools({ mode: 'detach' });
      event.preventDefault();
    }
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    // For production builds - React files are in electron/dist (committed)
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log('Loading from:', indexPath);
    console.log('File exists:', fs.existsSync(indexPath));
    
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath).catch(error => {
        console.error('Failed to load file:', error);
        dialog.showErrorBox(
          'Application Load Error',
          `Cannot load application file: ${error.message}`
        );
      });
    } else {
      console.error('Index.html not found at:', indexPath);
      dialog.showErrorBox(
        'Application Load Error',
        `Cannot find application files at: ${indexPath}`
      );
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
      
      // Save sidebar state before hiding
      windowState.sidebarWasOpen = sidebarWindowRef && !sidebarWindowRef.isDestroyed() && sidebarWindowRef.isVisible();
      
      // Hide sidebar window when main window is hidden
      if (sidebarWindowRef && !sidebarWindowRef.isDestroyed()) {
        sidebarWindowRef.hide();
      }
      
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
          
          // Restore sidebar window if it was open before hiding
          if (windowState.sidebarWasOpen && sidebarWindowRef && !sidebarWindowRef.isDestroyed()) {
            // Only show sidebar if main window is not maximized (sidebar doesn't work in maximized mode)
            if (!win.isMaximized()) {
              sidebarWindowRef.show();
            }
          }
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
      
      // Restore sidebar window if it was open before hiding
      if (windowState.sidebarWasOpen && sidebarWindowRef && !sidebarWindowRef.isDestroyed()) {
        // Only show sidebar if main window is not maximized (sidebar doesn't work in maximized mode)
        if (!win.isMaximized()) {
          sidebarWindowRef.show();
        }
      }
      
      // Only send IPC message if webContents is ready
      if (win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('get-settings-for-tray-launch');
      }
    }
  });
}

app.whenReady().then(async () => {
  const logFile = path.join(os.tmpdir(), 'update-log.txt');
  
  function writeLog(msg) {
    const line = `[${new Date().toISOString()}] [MainStartup] ${msg}`;
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (e) {
      console.error('Failed to write to update-log.txt:', e);
    }
    console.log(line);
  }

  writeLog('App startup initiated');
  
  // Only apply staged updates in packaged builds (production), not in development
  let updateJustApplied = false;
  if (app.isPackaged) {
    writeLog('App is packaged, checking for staged updates...');
    updateJustApplied = await applyStagedUpdate();
    writeLog(`Staged update applied: ${updateJustApplied}`);

    
    // If update was just applied, save the update state to show success notification
    if (updateJustApplied) {
      writeLog('Update was applied, saving update state...');
      const updateState = {
        success: true,
        timestamp: Date.now(),
        version: require('../package.json').version
      };
      
      const updateStateFile = path.join(app.getPath('userData'), 'update-state.json');
      try {
        fs.writeFileSync(updateStateFile, JSON.stringify(updateState, null, 2));
        writeLog('Update state saved successfully');
      } catch (error) {
        writeLog('Failed to save update state: ' + error);
      }
    }
  } else {
    writeLog('App is in development mode, skipping staged update check');
  }
  
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
    let soundPath;
    
    if (app.isPackaged) {
      // In packaged app, sounds are in extraResources
      soundPath = path.join(process.resourcesPath, 'sounds', `${notificationSound}.wav`);
    } else {
      // In development, sounds are in electron/sounds
      soundPath = path.join(__dirname, 'sounds', `${notificationSound}.wav`);
    }
    
    console.log('Sound path:', soundPath);
    console.log('Sound file exists:', fs.existsSync(soundPath));
    
    if (fs.existsSync(soundPath)) {
      const command = `powershell -c "(New-Object Media.SoundPlayer '${soundPath}').PlaySync();"`;
      
      exec(command, (error) => {
        if (error) {
          console.error('Sound playback error:', error);
          // Fallback to default player
          const altCommand = `start "" "${soundPath}"`;
          exec(altCommand, () => {});
        }
      });
    } else {
      console.error('Sound file not found:', soundPath);
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
    let soundPath;
    
    if (app.isPackaged) {
      // In packaged app, sounds are in extraResources
      soundPath = path.join(process.resourcesPath, 'sounds', `${sound}.wav`);
    } else {
      // In development, sounds are in electron/sounds
      soundPath = path.join(__dirname, 'sounds', `${sound}.wav`);
    }
    
    console.log('Preview sound path:', soundPath);
    console.log('Preview sound file exists:', fs.existsSync(soundPath));
    
    if (fs.existsSync(soundPath)) {
      // Use PowerShell to play the sound
      const command = `powershell -c "(New-Object Media.SoundPlayer '${soundPath}').PlaySync();"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Preview sound error:', error);
          // Fallback to default player
          const altCommand = `start "" "${soundPath}"`;
          exec(altCommand, (altError) => {
            if (altError) {
              console.error('Alternative sound playback failed:', altError);
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
      console.error('Preview sound file not found:', soundPath);
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
  const logFile = path.join(os.tmpdir(), 'update-log.txt');
  
  function writeLog(msg) {
    const line = `[${new Date().toISOString()}] [Download] ${msg}`;
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (e) {
      console.error('Failed to write to update-log.txt:', e);
    }
    console.log(line);
  }

  try {
    writeLog(`Starting download from: ${downloadUrl}`);
    const fileName = path.basename(downloadUrl);
    const tempPath = path.join(os.tmpdir(), fileName);
    writeLog(`Download destination: ${tempPath}`);
    
    // Download the update file and send progress to renderer
    await downloadFile(downloadUrl, tempPath, win);
    writeLog('Download completed successfully');
    
    // Return success without showing dialog - let the UI handle the restart prompt
    return { success: true, filePath: tempPath };
  } catch (error) {
    writeLog('Update download failed: ' + error);
    throw error;
  }
});

// Extract and install update (called from renderer after download)
ipcMain.handle('extract-and-install-update', async (_, filePath, version) => {
  const logFile = path.join(os.tmpdir(), 'update-log.txt');
  
  function writeLog(msg) {
    const line = `[${new Date().toISOString()}] [Extract] ${msg}`;
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (e) {
      console.error('Failed to write to update-log.txt:', e);
    }
    console.log(line);
  }

  writeLog(`extract-and-install-update called with filePath: ${filePath}, version: ${version}`);
  try {
    await extractAndInstallUpdate(filePath, win, version);
    writeLog('Extract and install completed successfully');
    return { success: true };
  } catch (error) {
    if (win && win.webContents) {
      win.webContents.send('update-install-progress', { phase: 'error', percent: 100, message: error.message });
    }
    writeLog('Update install failed: ' + error);
    throw error;
  }
});

// Cancel update download
ipcMain.handle('cancel-update', () => {
  console.log('[Electron] Update cancellation requested');
  
  if (currentDownload) {
    console.log('[Electron] Cancelling active download...');
    currentDownload.cancel();
    return { success: true, message: 'Download cancelled' };
  } else {
    console.log('[Electron] No active download to cancel');
    return { success: false, message: 'No active download' };
  }
});

// Restart the application
ipcMain.handle('restart-app', () => {
  const logFile = path.join(os.tmpdir(), 'update-log.txt');
  
  function writeLog(msg) {
    const line = `[${new Date().toISOString()}] [Restart] ${msg}`;
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (e) {
      console.error('Failed to write to update-log.txt:', e);
    }
    console.log(line);
  }

  writeLog('restart-app called');
  
  // Ensure all windows are closed and tray is cleaned up
  writeLog('Closing all windows...');
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.close();
    }
  });
  
  // Force quit after a short delay to ensure cleanup
  setTimeout(() => {
    writeLog('Executing app.relaunch() now...');
    app.relaunch(); // Remove --updated flag to allow normal startup with staging
    writeLog('app.exit(0) called');
    app.exit(0);
  }, 100);
});

// Handle update completion state
ipcMain.handle('mark-update-completed', (event, version) => {
  const logFile = path.join(os.tmpdir(), 'update-log.txt');
  
  function writeLog(msg) {
    const line = `[${new Date().toISOString()}] [MarkCompleted] ${msg}`;
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (e) {
      console.error('Failed to write to update-log.txt:', e);
    }
    console.log(line);
  }

  writeLog(`mark-update-completed called with version: ${version}`);
  
  // Store update completion in app data
  const fs = require('fs');
  const path = require('path');
  const userDataPath = app.getPath('userData');
  const updateStateFile = path.join(userDataPath, 'update-state.json');
  
  writeLog(`Writing update state to: ${updateStateFile}`);
  
  const updateState = {
    completed: true,
    version: version,
    timestamp: Date.now()
  };
  
  try {
    fs.writeFileSync(updateStateFile, JSON.stringify(updateState, null, 2));
    writeLog('Update state saved successfully');
  } catch (error) {
    writeLog('Failed to save update state: ' + error);
  }
});

// Apply staged update on startup
async function applyStagedUpdate() {
  const stagedUpdateFile = path.join(app.getPath('userData'), 'staged-update.json');
  const updateStateFile = path.join(app.getPath('userData'), 'update-state.json');
  const logFile = path.join(os.tmpdir(), 'update-log.txt');
  
  function writeLog(msg) {
    const line = `[${new Date().toISOString()}] [MainProcess] ${msg}`;
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (e) {
      console.error('Failed to write to update-log.txt:', e);
    }
    console.log(line);
  }

  try {
    writeLog('applyStagedUpdate called');
    if (!fs.existsSync(stagedUpdateFile)) {
      writeLog('No staged update file found.');
      return false;
    }
    const stagedUpdateInfo = JSON.parse(fs.readFileSync(stagedUpdateFile, 'utf8'));
    const extractPath = stagedUpdateInfo.extractPath;
    writeLog(`Found staged update for version ${stagedUpdateInfo.version}, extractPath: ${extractPath}`);
    
    if (!fs.existsSync(extractPath)) {
      writeLog('Extract path missing, cleaning up staged update file.');
      fs.unlinkSync(stagedUpdateFile);
      return false;
    }
    // Apply the update by copying files
    let appPath;
    if (app.isPackaged) {
      appPath = path.dirname(process.execPath);
    } else {
      appPath = app.getAppPath();
    }
    writeLog(`App path determined: ${appPath}`);
    
    const resourcesSrc = path.join(extractPath, 'resources');
    const resourcesDest = path.join(appPath, 'resources');
    const localesSrc = path.join(extractPath, 'locales');
    const localesDest = path.join(appPath, 'locales');
    const appPackagePath = path.join(resourcesSrc, 'app.package');
    const appAsarPath = path.join(resourcesDest, 'app.asar');
    const appAsarBackupPath = path.join(resourcesDest, 'app.asar.backup');
    
    writeLog(`Resources src: ${resourcesSrc}, dest: ${resourcesDest}`);
    writeLog(`App package path: ${appPackagePath}, exists: ${fs.existsSync(appPackagePath)}`);
    
    if (fs.existsSync(appPackagePath)) {
      try {
        if (!fs.existsSync(resourcesDest)) {
          fs.mkdirSync(resourcesDest, { recursive: true });
        }
        writeLog('Replacing app.asar with new version...');
        if (fs.existsSync(appAsarBackupPath)) {
          fs.unlinkSync(appAsarBackupPath);
        }
        if (fs.existsSync(appAsarPath)) {
          try {
            fs.renameSync(appAsarPath, appAsarBackupPath);
            writeLog('Old app.asar renamed to backup');
          } catch (renameError) {
            writeLog('Failed to rename old app.asar: ' + renameError);
          }
        }
        fs.copyFileSync(appPackagePath, appAsarPath);
        writeLog('New app.asar copied successfully');
        if (fs.existsSync(appAsarBackupPath)) {
          fs.unlinkSync(appAsarBackupPath);
          writeLog('Backup app.asar removed');
        }
      } catch (error) {
        writeLog('Failed to update app.asar: ' + error);
        try {
          if (fs.existsSync(appAsarBackupPath) && !fs.existsSync(appAsarPath)) {
            fs.renameSync(appAsarBackupPath, appAsarPath);
            writeLog('Restored backup app.asar after failed update');
          }
        } catch (restoreError) {
          writeLog('Failed to restore backup: ' + restoreError);
        }
        throw error;
      }
    }
    if (fs.existsSync(resourcesSrc)) {
      fs.readdirSync(resourcesSrc).forEach((item) => {
        if (item !== 'app.package') {
          const srcItem = path.join(resourcesSrc, item);
          const destItem = path.join(resourcesDest, item);
          copyRecursiveSync(srcItem, destItem);
        }
      });
      writeLog('Resources updated successfully');
    }
    if (fs.existsSync(localesSrc)) {
      copyRecursiveSync(localesSrc, localesDest);
      writeLog('Locales updated successfully');
    }
    // Clean up
    try { fs.rmSync(extractPath, { recursive: true, force: true }); } catch (e) { writeLog('Failed to remove extractPath: ' + e); }
    try { fs.unlinkSync(stagedUpdateFile); } catch (e) { writeLog('Failed to remove stagedUpdateFile: ' + e); }
    try { fs.unlinkSync(updateStateFile); } catch (e) { writeLog('Failed to remove updateStateFile: ' + e); }
    
    writeLog('Starting batch script creation and execution...');
    // Instead of relaunching here, launch a batch script that waits for this process to exit, applies the update, and then relaunches the app
    setTimeout(() => {
      writeLog('Closing all windows before update...');
      BrowserWindow.getAllWindows().forEach(win => win.destroy());
      const { exec } = require('child_process');
      const updaterScriptPath = path.join(__dirname, 'updater.js');
      const tempScriptPath = path.join(os.tmpdir(), 'update-and-restart.bat');
      const batchScript = `@echo off\r\nsetlocal\r\nset LOGFILE=%TEMP%\\update-log.txt\r\nif not exist "%TEMP%" mkdir "%TEMP%"\r\necho [%date% %time%] Batch script started. >> %LOGFILE%\r\nset EXE_NAME="${path.basename(process.execPath)}"\r\nset EXE_PATH="${process.execPath}"\r\nset UPDATER="${updaterScriptPath}"\r\necho [%date% %time%] Waiting for process to exit... >> %LOGFILE%\r\n:waitloop\r\ntasklist /FI "IMAGENAME eq %EXE_NAME%" | find /I %EXE_NAME% >nul\r\nif not errorlevel 1 (\r\n  timeout /t 1 >nul\r\n  goto waitloop\r\n)\r\necho [%date% %time%] Process exited. Waiting extra 3 seconds for file locks... >> %LOGFILE%\r\ntimeout /t 3 >nul\r\necho [%date% %time%] Running updater.js... >> %LOGFILE%\r\nnode "%UPDATER%" >> %LOGFILE% 2>&1\r\nif errorlevel 1 echo [%date% %time%] ERROR running updater.js >> %LOGFILE%\r\necho [%date% %time%] Relaunching app... >> %LOGFILE%\r\nstart "" %EXE_PATH%\r\nendlocal\r\necho [%date% %time%] Batch script finished. >> %LOGFILE%\r\n`;
      try {
        writeLog(`Writing batch script to: ${tempScriptPath}`);
        fs.writeFileSync(tempScriptPath, batchScript);
        writeLog('Created update-and-restart script, executing...');
        exec(`start "" "${tempScriptPath}"`, (error) => {
          if (error) {
            writeLog('Failed to execute update-and-restart script: ' + error);
            if (tray && tray.displayBalloon) {
              tray.displayBalloon({
                title: 'Update Complete',
                content: 'Please restart the app manually to load the new version.'
              });
            }
          } else {
            writeLog('Batch script launched successfully');
          }
          setTimeout(() => {
            writeLog('Main process exiting now...');
            process.exit(0);
          }, 1000);
        });
      } catch (error) {
        writeLog('Failed to create update-and-restart script: ' + error);
        if (tray && tray.displayBalloon) {
          tray.displayBalloon({
            title: 'Update Complete',
            content: 'Please restart the app manually to load the new version.'
          });
        }
        setTimeout(() => {
          writeLog('Main process exiting after error...');
          process.exit(0);
        }, 2000);
      }
    }, 3000);
    return true;
  } catch (error) {
    writeLog('Failed to apply staged update: ' + error);
    try { fs.unlinkSync(stagedUpdateFile); } catch (e) { writeLog('Failed to remove stagedUpdateFile after error: ' + e); }
    try { fs.unlinkSync(updateStateFile); } catch (e) { writeLog('Failed to remove updateStateFile after error: ' + e); }
    return false;
  }
}

// Check if app was restarted after update
ipcMain.handle('check-update-state', () => {
  const logFile = path.join(os.tmpdir(), 'update-log.txt');
  
  function writeLog(msg) {
    const line = `[${new Date().toISOString()}] [CheckState] ${msg}`;
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (e) {
      console.error('Failed to write to update-log.txt:', e);
    }
    console.log(line);
  }

  const fs = require('fs');
  const path = require('path');
  const userDataPath = app.getPath('userData');
  const updateStateFile = path.join(userDataPath, 'update-state.json');
  
  writeLog(`check-update-state called, looking for file: ${updateStateFile}`);
  
  try {
    if (fs.existsSync(updateStateFile)) {
      const updateState = JSON.parse(fs.readFileSync(updateStateFile, 'utf8'));
      writeLog(`Found update state file with content: ${JSON.stringify(updateState, null, 2)}`);
      // Clear the state file after reading
      fs.unlinkSync(updateStateFile);
      writeLog('Update state file deleted after reading');
      return updateState;
    } else {
      writeLog('No update state file found');
    }
  } catch (error) {
    writeLog('Failed to read update state: ' + error);
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
