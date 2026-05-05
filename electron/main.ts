import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork, ChildProcess } from 'child_process';
import { dirname } from 'path';

// In a bundled CJS environment, __dirname is globally available.
// We only need to compute it if we are running in raw ESM mode.
// Since tsup bundles to CJS, we can rely on the globals.


let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e1e',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false 
    },
  });

  // Remove native menu bar
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  const { ipcMain } = require('electron');
  
  // Window Controls IPC
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow?.close());

  // 1. Start Backend Server
  const isDev = !app.isPackaged;
  const port = process.env.PORT || 5001;
  
  // In production, we run the bundled server.js
  const serverPath = isDev 
    ? path.join(__dirname, '../server.ts') 
    : path.join(process.resourcesPath, 'app.asar.unpacked/server.js');

  console.log(`[Electron] Starting server at ${serverPath}`);
  
  serverProcess = fork(serverPath, [], {
    env: { 
      ...process.env, 
      NODE_ENV: isDev ? 'development' : 'production',
      PORT: port.toString(),
      ELECTRON_RUN_AS_NODE: '1',
      RESOURCES_PATH: process.resourcesPath
    },
    execArgv: isDev ? ['--loader', 'tsx'] : []
  });

  serverProcess.on('error', (err) => {
    console.error('[Electron] Server failed to start:', err);
  });

  // 2. Load Content
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  // Open links in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (serverProcess) serverProcess.kill();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
