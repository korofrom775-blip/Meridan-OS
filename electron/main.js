/* =================================================================
   MERIDIAN OS — Electron main process
   Wraps the existing static app (index.html) in a desktop window.
   webviewTag is enabled so the in-app Browser uses <webview> instead
   of the iframe+local-proxy workaround the plain-web build needs —
   a webview is an independent guest page, so most sites that refuse
   iframe embedding (X-Frame-Options / CSP frame-ancestors) still load.
   ================================================================= */
const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow(){
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#0b0b0d',
    title: 'Meridian OS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Required for the Browser app's <webview> tabs.
      webviewTag: true
    }
  });

  // Each guest page a <webview> opens gets Electron defaults applied here
  // (webview tags don't inherit the host BrowserWindow's webPreferences).
  win.webContents.on('did-attach-webview', (_event, webContents) => {
    webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'index.html'));

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
