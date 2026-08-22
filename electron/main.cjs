const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const LOCAL_URL = 'http://127.0.0.1:8787/?offline=1&desktop=1';
const HEALTH_URL = 'http://127.0.0.1:8787/api/health';
let bridgeProcess = null;
let mainWindow = null;
let logStream = null;

function ping(url, timeout = 1800) {
  return new Promise(resolve => {
    const req = http.get(url, res => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 500); });
    req.setTimeout(timeout, () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

async function waitFor(url, attempts = 30, delay = 400) {
  for (let i = 0; i < attempts; i++) {
    if (await ping(url)) return true;
    await new Promise(r => setTimeout(r, delay));
  }
  return false;
}

async function ensureOllama() {
  if (await ping('http://127.0.0.1:11434/api/tags', 900)) return { ok: true, started: false };
  try {
    const child = spawn('ollama', ['serve'], { detached: true, windowsHide: true, stdio: 'ignore' });
    child.unref();
    const ok = await waitFor('http://127.0.0.1:11434/api/tags', 16, 500);
    return { ok, started: ok };
  } catch {
    return { ok: false, started: false };
  }
}

async function ensureBridge() {
  if (await ping(HEALTH_URL)) return true;
  const root = app.getAppPath();
  const serverFile = path.join(root, 'bridge', 'server.mjs');
  if (!fs.existsSync(serverFile)) throw new Error(`Thiếu HNL Bridge: ${serverFile}`);

  const logPath = path.join(app.getPath('userData'), 'hnl-bridge.log');
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
  bridgeProcess = spawn(process.execPath, [serverFile], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: '8787',
      HNL_DESKTOP: '1',
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  bridgeProcess.stdout?.pipe(logStream, { end: false });
  bridgeProcess.stderr?.pipe(logStream, { end: false });
  bridgeProcess.on('error', err => logStream?.write(`\n[bridge error] ${err.stack || err.message}\n`));
  return waitFor(HEALTH_URL, 35, 400);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1050,
    minHeight: 680,
    show: false,
    backgroundColor: '#eef3f8',
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), 'public', 'hnl-mark-512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

async function boot() {
  const win = createWindow();
  await ensureOllama();
  let bridgeOk = false;
  try { bridgeOk = await ensureBridge(); } catch (error) {
    logStream?.write(`\n[boot] ${error.stack || error.message}\n`);
  }

  if (bridgeOk) {
    await win.loadURL(LOCAL_URL);
    return;
  }

  const fallback = path.join(app.getAppPath(), 'dist', 'index.html');
  if (fs.existsSync(fallback)) {
    await win.loadFile(fallback, { query: { desktop: '1' } });
  }
  dialog.showMessageBox(win, {
    type: 'warning',
    title: 'HNL Local Engine chưa khởi động',
    message: 'Ứng dụng vẫn mở được để dùng AI Online/tra cứu cục bộ, nhưng Offline AI cần HNL Bridge tại 127.0.0.1:8787.',
    detail: `Xem log: ${path.join(app.getPath('userData'), 'hnl-bridge.log')}`
  });
}

if (process.platform === 'win32') app.setAppUserModelId('com.hnl.pilestandardsai');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(boot);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  try { bridgeProcess?.kill(); } catch {}
  try { logStream?.end(); } catch {}
});
