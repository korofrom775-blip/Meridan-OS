/* =================================================================
   MERIDIAN OS — preload script
   contextIsolation is on and nodeIntegration is off, so the renderer
   has no Node/Electron access by default. This exposes exactly one
   flag the app's own JS can check — nothing more.
   ================================================================= */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('meridianElectron', {
  isElectron: true
});
