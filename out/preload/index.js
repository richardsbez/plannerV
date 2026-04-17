"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // ── Window controls ────────────────────────────────────────────────────────
  minimize: () => electron.ipcRenderer.invoke("window-minimize"),
  maximize: () => electron.ipcRenderer.invoke("window-maximize"),
  close: () => electron.ipcRenderer.invoke("window-close"),
  // ── Vault API ──────────────────────────────────────────────────────────────
  vault: {
    /** Returns the currently active vault path, or null if none selected. */
    get: () => electron.ipcRenderer.invoke("vault:get"),
    /** Opens a directory-picker dialog and sets the selected dir as vault. */
    select: () => electron.ipcRenderer.invoke("vault:select"),
    /** Read a file at path relative to vault root. Returns null if not found. */
    readFile: (path) => electron.ipcRenderer.invoke("vault:read-file", path),
    /** Write content to a file at path relative to vault root. */
    writeFile: (path, content) => electron.ipcRenderer.invoke("vault:write-file", path, content),
    /** Delete a file at path relative to vault root. */
    deleteFile: (path) => electron.ipcRenderer.invoke("vault:delete-file", path),
    /** List all .md files in a vault sub-directory. */
    listFiles: (dir) => electron.ipcRenderer.invoke("vault:list-files", dir),
    // ── FS Watch events ──────────────────────────────────────────────────────
    onFileChanged: (cb) => {
      electron.ipcRenderer.on("vault:file-changed", (_e, data) => cb(data));
    },
    onFileAdded: (cb) => {
      electron.ipcRenderer.on("vault:file-added", (_e, data) => cb(data));
    },
    onFileRemoved: (cb) => {
      electron.ipcRenderer.on("vault:file-removed", (_e, data) => cb(data));
    },
    offAll: () => {
      electron.ipcRenderer.removeAllListeners("vault:file-changed");
      electron.ipcRenderer.removeAllListeners("vault:file-added");
      electron.ipcRenderer.removeAllListeners("vault:file-removed");
    },
    /**
     * Synchronous batch write — used in `beforeunload` to guarantee all
     * debounced writes are flushed before the window/app closes.
     */
    syncFlush: (entries) => {
      electron.ipcRenderer.sendSync("vault:sync-flush", entries);
    }
  },
  // ── Flush handshake (close guard) ─────────────────────────────────────────
  // Main process sends 'app:request-flush' before closing. Renderer must call
  // syncFlushAllPending() then invoke notifyFlushDone() to ack.
  onRequestFlush: (cb) => {
    electron.ipcRenderer.on("app:request-flush", () => cb());
  },
  notifyFlushDone: () => {
    electron.ipcRenderer.send("app:flush-done");
  }
});
