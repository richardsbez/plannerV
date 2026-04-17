// ── vault.ts ────────────────────────────────────────────────────────────────
// Vault management: directory selection, file I/O, FS watching (chokidar).
// All vault-related IPC handlers are registered here.

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import {
  existsSync, mkdirSync, readFileSync,
  writeFileSync, unlinkSync, readdirSync, statSync,
} from 'fs'
import { join, relative, dirname } from 'path'
import chokidar, { FSWatcher } from 'chokidar'

// ── Vault path persistence ───────────────────────────────────────────────────
const VAULT_CONFIG_FILE = join(app.getPath('userData'), 'vault-config.json')

function loadSavedVaultPath(): string | null {
  try {
    if (existsSync(VAULT_CONFIG_FILE)) {
      const cfg = JSON.parse(readFileSync(VAULT_CONFIG_FILE, 'utf-8'))
      if (cfg.path && existsSync(cfg.path)) return cfg.path
    }
  } catch { /* ignore */ }
  return null
}

function saveVaultPath(vaultPath: string) {
  writeFileSync(VAULT_CONFIG_FILE, JSON.stringify({ path: vaultPath }), 'utf-8')
}

// ── Vault directory scaffold ─────────────────────────────────────────────────
//
// Mirrors the Obsidian-compatible layout documented in format.ts.
// Directories are created on first vault selection (and on every open if missing).
const VAULT_DIRS = ['.planner', 'tasks', 'notas', 'diario', 'habitos', 'humor', 'docs', 'top3']

// Files written once at vault creation (never overwritten)
const VAULT_STUBS: Array<{ path: string; content: string }> = [
  // Minimal Obsidian app.json so the vault is recognized by Obsidian
  {
    path: '.obsidian/app.json',
    content: JSON.stringify({ promptDelete: false }, null, 2) + '\n',
  },
  // Dataview plugin config so inline fields [key:: value] are indexed
  {
    path: '.obsidian/plugins/dataview/data.json',
    content: JSON.stringify(
      { version: '0.5.66', enableInlineDataview: true, enableDataviewJs: false },
      null, 2,
    ) + '\n',
  },
  // CSS snippet that gives each cssclass a subtle left-border accent in Obsidian
  {
    path: '.obsidian/snippets/planner.css',
    content: [
      '/* Planner panel styles for Obsidian */',
      '.planner-tasks    { border-left: 3px solid #2383e2; padding-left: 8px; }',
      '.planner-journal  { border-left: 3px solid #dfab01; padding-left: 8px; }',
      '.planner-habits   { border-left: 3px solid #0f9f6e; padding-left: 8px; }',
      '.planner-mood     { border-left: 3px solid #e03e3e; padding-left: 8px; }',
      '.planner-top3     { border-left: 3px solid #9b59b6; padding-left: 8px; }',
      '.planner-notes    { border-left: 3px solid #718096; padding-left: 8px; }',
      '.planner-archive  { opacity: 0.8; }',
      '.planner-workspace{ font-family: monospace; font-size: 12px; }',
    ].join('\n') + '\n',
  },
]

function ensureVaultStructure(vaultPath: string) {
  // 1. Create all required directories
  for (const dir of VAULT_DIRS) {
    mkdirSync(join(vaultPath, dir), { recursive: true })
  }

  // 2. Create .obsidian dirs
  mkdirSync(join(vaultPath, '.obsidian', 'plugins', 'dataview'), { recursive: true })
  mkdirSync(join(vaultPath, '.obsidian', 'snippets'), { recursive: true })

  // 3. Write stubs only if they don't already exist (idempotent)
  for (const { path: relPath, content } of VAULT_STUBS) {
    const fullPath = join(vaultPath, relPath)
    if (!existsSync(fullPath)) {
      try {
        writeFileSync(fullPath, content, 'utf-8')
      } catch { /* ignore — non-critical */ }
    }
  }
}

// ── FS Watcher ───────────────────────────────────────────────────────────────
let watcher: FSWatcher | null = null

// Files that were written by the app itself — skip echoing those back.
const appWriteLocks = new Set<string>()

function startWatcher(vaultPath: string, win: BrowserWindow) {
  if (watcher) { watcher.close(); watcher = null }

  watcher = chokidar.watch(vaultPath, {
    // Allow .planner/ and .obsidian/ — ignore all other hidden paths
    ignored: (p: string) => {
      const rel = relative(vaultPath, p)
      if (rel === '.planner'  || rel.startsWith('.planner/'))  return false
      if (rel === '.obsidian' || rel.startsWith('.obsidian/')) return false
      return /(^|[/\\])\../.test(rel)
    },
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  })

  const emit = (event: string, payload: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(event, payload)
  }

  watcher
    .on('change', (filePath) => {
      if (appWriteLocks.has(filePath)) return
      const rel = relative(vaultPath, filePath)
      if (!rel.endsWith('.md') && !rel.startsWith('.planner')) return
      try {
        const content = readFileSync(filePath, 'utf-8')
        emit('vault:file-changed', { path: rel, content })
      } catch { /* file may have been deleted in the meantime */ }
    })
    .on('add', (filePath) => {
      const rel = relative(vaultPath, filePath)
      if (!rel.endsWith('.md')) return
      if (appWriteLocks.has(filePath)) return
      try {
        const content = readFileSync(filePath, 'utf-8')
        emit('vault:file-added', { path: rel, content })
      } catch { /* ignore */ }
    })
    .on('unlink', (filePath) => {
      const rel = relative(vaultPath, filePath)
      emit('vault:file-removed', { path: rel })
    })
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────
let currentVaultPath: string | null = null

export function registerVaultHandlers(win: BrowserWindow) {
  // Restore last vault on startup
  currentVaultPath = loadSavedVaultPath()
  if (currentVaultPath) startWatcher(currentVaultPath, win)

  // ── Get current vault path ─────────────────────────────────────────────────
  ipcMain.handle('vault:get', () => currentVaultPath)

  // ── Select a new vault directory ──────────────────────────────────────────
  ipcMain.handle('vault:select', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Selecionar Cofre (Vault)',
      properties: ['openDirectory', 'createDirectory'],
      message: 'Escolha um diretório para usar como cofre do Planner',
      buttonLabel: 'Usar como Cofre',
    })
    if (result.canceled || !result.filePaths[0]) return null

    const vaultPath = result.filePaths[0]
    ensureVaultStructure(vaultPath)
    saveVaultPath(vaultPath)
    currentVaultPath = vaultPath
    startWatcher(vaultPath, win)
    return vaultPath
  })

  // ── Synchronous batch flush (called from renderer beforeunload / vault switch) ─
  // Uses ipcMain.on (not handle) because sendSync requires on + event.returnValue.
  ipcMain.on('vault:sync-flush', (event, entries: Array<{ path: string; content: string }>) => {
    if (!currentVaultPath) { event.returnValue = false; return }
    for (const { path: relPath, content } of entries) {
      try {
        const filePath = join(currentVaultPath, relPath)
        mkdirSync(dirname(filePath), { recursive: true })
        appWriteLocks.add(filePath)
        writeFileSync(filePath, content, 'utf-8')
        setTimeout(() => appWriteLocks.delete(filePath), 600)
      } catch (e) {
        console.error('vault:sync-flush error:', e)
      }
    }
    event.returnValue = true
  })

  // ── Read a file relative to vault ─────────────────────────────────────────
  ipcMain.handle('vault:read-file', (_e, relativePath: string) => {
    if (!currentVaultPath) return null
    const filePath = join(currentVaultPath, relativePath)
    try {
      if (existsSync(filePath)) return readFileSync(filePath, 'utf-8')
    } catch { /* ignore */ }
    return null
  })

  // ── Write a file relative to vault ────────────────────────────────────────
  ipcMain.handle('vault:write-file', (_e, relativePath: string, content: string) => {
    if (!currentVaultPath) return false
    const filePath = join(currentVaultPath, relativePath)
    try {
      mkdirSync(dirname(filePath), { recursive: true })
      // Mark as app-write so the watcher doesn't echo it back
      appWriteLocks.add(filePath)
      writeFileSync(filePath, content, 'utf-8')
      // Release the lock after the watcher's awaitWriteFinish window
      setTimeout(() => appWriteLocks.delete(filePath), 600)
      return true
    } catch (e) {
      console.error('vault:write-file error:', e)
      return false
    }
  })

  // ── Delete a file relative to vault ───────────────────────────────────────
  ipcMain.handle('vault:delete-file', (_e, relativePath: string) => {
    if (!currentVaultPath) return false
    const filePath = join(currentVaultPath, relativePath)
    try {
      if (existsSync(filePath)) unlinkSync(filePath)
      return true
    } catch { return false }
  })

  // ── List .md files in a vault subdirectory ────────────────────────────────
  ipcMain.handle('vault:list-files', (_e, dir: string) => {
    if (!currentVaultPath) return []
    const dirPath = join(currentVaultPath, dir)
    try {
      if (!existsSync(dirPath)) return []
      return readdirSync(dirPath)
        .filter((f) => f.endsWith('.md'))
        .map((f) => {
          const fp = join(dirPath, f)
          return { name: f, path: `${dir}/${f}`, mtime: statSync(fp).mtimeMs }
        })
    } catch { return [] }
  })
}
