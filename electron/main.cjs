const { app, BrowserWindow, dialog, shell, screen } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:8787';
let bridgePort = 8787;
const localUrl = () => `http://127.0.0.1:${bridgePort}/?offline=1&desktop=1`;
const healthUrl = () => `http://127.0.0.1:${bridgePort}/api/health`;
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

function checkHnlBridge(url, timeout = 1600) {
  return new Promise(resolve => {
    const req = http.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { if (body.length < 16384) body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          resolve(Boolean(data?.ok && data?.service === 'HNL AI Bridge'));
        } catch { resolve(false); }
      });
    });
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
    let spawnFailed = false;
    child.once('error', () => { spawnFailed = true; });
    child.unref();
    for (let i = 0; i < 16; i++) {
      if (spawnFailed) return { ok: false, started: false };
      if (await ping('http://127.0.0.1:11434/api/tags', 900)) return { ok: true, started: true };
      await new Promise(r => setTimeout(r, 350));
    }
    return { ok: false, started: false };
  } catch {
    return { ok: false, started: false };
  }
}

async function ensureBridge() {
  for (const candidate of [8787, 8788, 8789, 8790, 8791]) {
    bridgePort = candidate;
    if (await checkHnlBridge(healthUrl(), 900)) return true;
    const occupied = await ping(`http://127.0.0.1:${candidate}/`, 450);
    if (occupied) continue;

    const root = app.getAppPath();
    const serverFile = path.join(root, 'bridge', 'server.mjs');
    if (!fs.existsSync(serverFile)) throw new Error(`Thiếu HNL Bridge: ${serverFile}`);
    const logPath = path.join(app.getPath('userData'), 'hnl-bridge.log');
    if (!logStream) logStream = fs.createWriteStream(logPath, { flags: 'a' });
    bridgeProcess = spawn(process.execPath, [serverFile], {
      cwd: root,
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(candidate), HNL_DESKTOP: '1', OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    bridgeProcess.stdout?.pipe(logStream, { end: false });
    bridgeProcess.stderr?.pipe(logStream, { end: false });
    bridgeProcess.on('error', err => logStream?.write(`\n[bridge error] ${err.stack || err.message}\n`));
    for (let i = 0; i < 30; i++) {
      if (await checkHnlBridge(healthUrl(), 1200)) return true;
      await new Promise(r => setTimeout(r, 250));
    }
    try { bridgeProcess?.kill(); } catch {}
    bridgeProcess = null;
  }
  return false;
}

function createWindow() {
  const work = screen.getPrimaryDisplay().workAreaSize;
  const minWidth = Math.min(900, Math.max(720, work.width - 80));
  const minHeight = Math.min(620, Math.max(540, work.height - 80));
  const width = Math.max(minWidth, Math.min(1500, Math.floor(work.width * 0.96)));
  const height = Math.max(minHeight, Math.min(940, Math.floor(work.height * 0.94)));
  mainWindow = new BrowserWindow({
    width, height, minWidth, minHeight, center: true,
    show: false,
    backgroundColor: '#eef3f8',
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), 'public', 'hnl-mark-512.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
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
  let bridgeOk = false;
  try { bridgeOk = await ensureBridge(); } catch (error) {
    logStream?.write(`\n[boot] ${error.stack || error.message}\n`);
  }
  if (bridgeOk) {
    await win.loadURL(localUrl());
    ensureOllama().catch(error => logStream?.write(`\n[ollama] ${error.stack || error.message}\n`));
    return;
  }
  const fallback = path.join(app.getAppPath(), 'dist', 'index.html');
  if (fs.existsSync(fallback)) await win.loadFile(fallback, { query: { desktop: '1' } });
  dialog.showMessageBox(win, {
    type: 'warning',
    title: 'HNL Local Engine chưa khởi động',
    message: 'Ứng dụng vẫn mở để dùng AI Online/tra cứu cục bộ. Offline AI chỉ cần khi bạn chọn Ollama.',
    detail: `Bridge không khởi động được trên các cổng 8787–8791. Xem log: ${path.join(app.getPath('userData'), 'hnl-bridge.log')}`
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
