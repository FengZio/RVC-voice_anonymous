const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let backendProcess = null;

function rootPath() {
  return app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
}

function startBackend() {
  const root = rootPath();
  const script = path.join(root, 'backend_api.py');
  backendProcess = spawn('python', [script], {
    cwd: root,
    env: process.env,
    windowsHide: true,
    stdio: 'ignore'
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: 'RVC Voice Anonymous',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.RVC_FRONTEND_DEV_URL;
  win.loadURL(devUrl || 'http://127.0.0.1:7860');
}

app.whenReady().then(() => {
  startBackend();
  setTimeout(createWindow, 1200);
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  app.quit();
});

