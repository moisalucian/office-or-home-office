const { app, BrowserWindow, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const isHiddenLaunch = process.argv.includes('--hidden');

let popupWindowRef = null;
let tray = null;
let win;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const maxHeight = Math.floor(screenHeight * 0.9);

  win = new BrowserWindow({
    width: 800,
    height: maxHeight,
    show: !isHiddenLaunch, //  NU arătăm fereastra dacă e lansare cu --hidden
    frame: false,
    transparent: true,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../react-ui/dist/index.html'));
  }

  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide(); // 🔒 ascunde în loc să închidă
    }
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.ico'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        if (win) win.show();
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
    if (win) win.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 🔔 Deschidere popup
ipcMain.on('show-notification-popup', () => {
  popupWindowRef = new BrowserWindow({
    width: 350,
    height: 250,
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

// ✅ Primire răspuns din popup
ipcMain.on('submit-status', (_, status) => {
  if (win?.webContents) {
    win.webContents.send('popup-status', status);
  }

  if (popupWindowRef) {
    popupWindowRef.close();
    popupWindowRef = null;
  }
});

// ✅ Control fereastră
ipcMain.on('minimize-window', () => {
  if (win) win.minimize();
});
ipcMain.on('maximize-window', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});
ipcMain.on('close-window', () => {
  if (win) win.close(); // va fi interceptat și doar ascuns
});

// ✅ Setare startup
ipcMain.on('set-startup', (_, shouldLaunchAtStartup) => {
  app.setLoginItemSettings({
    openAtLogin: shouldLaunchAtStartup,
    path: process.execPath,
    args: app.isPackaged ? ['--hidden'] : []
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
