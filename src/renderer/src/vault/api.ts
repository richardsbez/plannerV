// ── vault/api.ts ──────────────────────────────────────────────────────────────
// Thin wrapper around window.electronAPI.vault that provides a consistent
// interface regardless of whether we're in Electron or a plain browser (for
// development / Storybook). The localStorage stub keeps the app usable without
// Electron, but the Vault feature requires Electron.

type FileChangedCb  = (d: { path: string; content: string }) => void
type FileAddedCb    = (d: { path: string; content: string }) => void
type FileRemovedCb  = (d: { path: string })                  => void

interface VaultAPI {
  get:          () => Promise<string | null>
  select:       () => Promise<string | null>
  readFile:     (path: string) => Promise<string | null>
  writeFile:    (path: string, content: string) => Promise<boolean>
  deleteFile:   (path: string) => Promise<boolean>
  listFiles:    (dir: string) => Promise<Array<{ name: string; path: string; mtime: number }>>
  /** Synchronous batch write — for use inside `beforeunload` only. */
  syncFlush:    (entries: Array<{ path: string; content: string }>) => void
  onFileChanged:(cb: FileChangedCb) => void
  onFileAdded:  (cb: FileAddedCb) => void
  onFileRemoved:(cb: FileRemovedCb) => void
  offAll:       () => void
}

// ── Electron implementation ───────────────────────────────────────────────────
const electronVault: VaultAPI = {
  get:          () => window.electronAPI!.vault.get(),
  select:       () => window.electronAPI!.vault.select(),
  readFile:     (p) => window.electronAPI!.vault.readFile(p),
  writeFile:    (p, c) => window.electronAPI!.vault.writeFile(p, c),
  deleteFile:   (p) => window.electronAPI!.vault.deleteFile(p),
  listFiles:    (d) => window.electronAPI!.vault.listFiles(d),
  syncFlush:    (entries) => window.electronAPI!.vault.syncFlush(entries),
  onFileChanged:(cb) => window.electronAPI!.vault.onFileChanged(cb),
  onFileAdded:  (cb) => window.electronAPI!.vault.onFileAdded(cb),
  onFileRemoved:(cb) => window.electronAPI!.vault.onFileRemoved(cb),
  offAll:       () => window.electronAPI!.vault.offAll(),
}

// ── localStorage stub (browser / no-Electron) ────────────────────────────────
const LS_PREFIX = 'vault:'
const localVault: VaultAPI = {
  get:          async () => 'local-stub',
  select:       async () => 'local-stub',
  readFile:     async (p) => localStorage.getItem(LS_PREFIX + p),
  writeFile:    async (p, c) => { localStorage.setItem(LS_PREFIX + p, c); return true },
  deleteFile:   async (p) => { localStorage.removeItem(LS_PREFIX + p); return true },
  listFiles:    async (dir) => {
    const prefix = LS_PREFIX + dir + '/'
    return Object.keys(localStorage)
      .filter(k => k.startsWith(prefix) && k.endsWith('.md'))
      .map(k => ({ name: k.slice(prefix.length), path: k.slice(LS_PREFIX.length), mtime: 0 }))
  },
  syncFlush:    (entries) => {
    for (const { path: p, content: c } of entries) {
      localStorage.setItem(LS_PREFIX + p, c)
    }
  },
  onFileChanged:() => { /* no FS watching in browser */ },
  onFileAdded:  () => {},
  onFileRemoved:() => {},
  offAll:       () => {},
}

export const vaultAPI: VaultAPI =
  typeof window !== 'undefined' && window.electronAPI?.vault
    ? electronVault
    : localVault

// ── Vault store (Zustand-free reactive singleton) ────────────────────────────
// Tracks the active vault path so components can react to vault selection.

type VaultListener = (path: string | null) => void
const listeners = new Set<VaultListener>()
let _vaultPath: string | null = null

export const vaultStore = {
  getPath: () => _vaultPath,
  setPath: (path: string | null) => {
    _vaultPath = path
    listeners.forEach(fn => fn(path))
  },
  subscribe: (fn: VaultListener) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}
