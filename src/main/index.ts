import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { registerVaultHandlers } from './vault'

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#F5F0E8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // ── Close guard: flush all pending writes before closing ──────────────────
  // Uses a two-step approach:
  //   1. Primary: send 'app:request-flush' IPC to renderer, wait for
  //      'app:flush-done' reply (renderer calls syncFlushAllPending then acks).
  //   2. Safety fallback: if renderer doesn't reply within 1200ms, force close
  //      anyway so the app never hangs.
  //
  // This avoids the previous race condition where the 400ms close-guard delay
  // was identical to the debounce delay — the debounce timer would fire first,
  // delete its entry from the timers Map, then beforeunload found nothing to
  // flush via syncFlushAllPending, silently dropping the write.
  let closeAllowed = false
  let flushFallbackTimer: ReturnType<typeof setTimeout> | null = null

  mainWindow.on('close', (e) => {
    if (!closeAllowed) {
      e.preventDefault()

      // Fallback: force-close after 1200ms regardless
      flushFallbackTimer = setTimeout(() => {
        closeAllowed = true
        mainWindow.close()
      }, 1200)

      // Ask renderer to flush synchronously, then ack
      mainWindow.webContents.send('app:request-flush')
    }
  })

  ipcMain.once('app:flush-done', () => {
    if (flushFallbackTimer) { clearTimeout(flushFallbackTimer); flushFallbackTimer = null }
    closeAllowed = true
    mainWindow.close()
  })

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Register all vault IPC handlers (file I/O + FS watcher)
  registerVaultHandlers(mainWindow)

  return mainWindow
}

// Window controls
ipcMain.handle('window-minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
ipcMain.handle('window-maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  win?.isMaximized() ? win.unmaximize() : win?.maximize()
})
ipcMain.handle('window-close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
