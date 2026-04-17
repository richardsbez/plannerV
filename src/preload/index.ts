import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Window controls ────────────────────────────────────────────────────────
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close:    () => ipcRenderer.invoke('window-close'),

  // ── Vault API ──────────────────────────────────────────────────────────────
  vault: {
    /** Returns the currently active vault path, or null if none selected. */
    get: (): Promise<string | null> =>
      ipcRenderer.invoke('vault:get'),

    /** Opens a directory-picker dialog and sets the selected dir as vault. */
    select: (): Promise<string | null> =>
      ipcRenderer.invoke('vault:select'),

    /** Read a file at path relative to vault root. Returns null if not found. */
    readFile: (path: string): Promise<string | null> =>
      ipcRenderer.invoke('vault:read-file', path),

    /** Write content to a file at path relative to vault root. */
    writeFile: (path: string, content: string): Promise<boolean> =>
      ipcRenderer.invoke('vault:write-file', path, content),

    /** Delete a file at path relative to vault root. */
    deleteFile: (path: string): Promise<boolean> =>
      ipcRenderer.invoke('vault:delete-file', path),

    /** List all .md files in a vault sub-directory. */
    listFiles: (dir: string): Promise<Array<{ name: string; path: string; mtime: number }>> =>
      ipcRenderer.invoke('vault:list-files', dir),

    // ── FS Watch events ──────────────────────────────────────────────────────
    onFileChanged: (cb: (data: { path: string; content: string }) => void) => {
      ipcRenderer.on('vault:file-changed', (_e, data) => cb(data))
    },
    onFileAdded: (cb: (data: { path: string; content: string }) => void) => {
      ipcRenderer.on('vault:file-added', (_e, data) => cb(data))
    },
    onFileRemoved: (cb: (data: { path: string }) => void) => {
      ipcRenderer.on('vault:file-removed', (_e, data) => cb(data))
    },
    offAll: () => {
      ipcRenderer.removeAllListeners('vault:file-changed')
      ipcRenderer.removeAllListeners('vault:file-added')
      ipcRenderer.removeAllListeners('vault:file-removed')
    },

    /**
     * Synchronous batch write — used in `beforeunload` to guarantee all
     * debounced writes are flushed before the window/app closes.
     */
    syncFlush: (entries: Array<{ path: string; content: string }>): void => {
      ipcRenderer.sendSync('vault:sync-flush', entries)
    },
  },

  // ── Flush handshake (close guard) ─────────────────────────────────────────
  // Main process sends 'app:request-flush' before closing. Renderer must call
  // syncFlushAllPending() then invoke notifyFlushDone() to ack.
  onRequestFlush: (cb: () => void) => {
    ipcRenderer.on('app:request-flush', () => cb())
  },
  notifyFlushDone: () => {
    ipcRenderer.send('app:flush-done')
  },
})
