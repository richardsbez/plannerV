"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const chokidar = require("chokidar");
const VAULT_CONFIG_FILE = path.join(electron.app.getPath("userData"), "vault-config.json");
function loadSavedVaultPath() {
  try {
    if (fs.existsSync(VAULT_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(VAULT_CONFIG_FILE, "utf-8"));
      if (cfg.path && fs.existsSync(cfg.path)) return cfg.path;
    }
  } catch {
  }
  return null;
}
function saveVaultPath(vaultPath) {
  fs.writeFileSync(VAULT_CONFIG_FILE, JSON.stringify({ path: vaultPath }), "utf-8");
}
const VAULT_DIRS = [".planner", "tasks", "notas", "diario", "habitos", "humor", "docs", "top3"];
const VAULT_STUBS = [
  // Minimal Obsidian app.json so the vault is recognized by Obsidian
  {
    path: ".obsidian/app.json",
    content: JSON.stringify({ promptDelete: false }, null, 2) + "\n"
  },
  // Dataview plugin config so inline fields [key:: value] are indexed
  {
    path: ".obsidian/plugins/dataview/data.json",
    content: JSON.stringify(
      { version: "0.5.66", enableInlineDataview: true, enableDataviewJs: false },
      null,
      2
    ) + "\n"
  },
  // CSS snippet that gives each cssclass a subtle left-border accent in Obsidian
  {
    path: ".obsidian/snippets/planner.css",
    content: [
      "/* Planner panel styles for Obsidian */",
      ".planner-tasks    { border-left: 3px solid #2383e2; padding-left: 8px; }",
      ".planner-journal  { border-left: 3px solid #dfab01; padding-left: 8px; }",
      ".planner-habits   { border-left: 3px solid #0f9f6e; padding-left: 8px; }",
      ".planner-mood     { border-left: 3px solid #e03e3e; padding-left: 8px; }",
      ".planner-top3     { border-left: 3px solid #9b59b6; padding-left: 8px; }",
      ".planner-notes    { border-left: 3px solid #718096; padding-left: 8px; }",
      ".planner-archive  { opacity: 0.8; }",
      ".planner-workspace{ font-family: monospace; font-size: 12px; }"
    ].join("\n") + "\n"
  }
];
function ensureVaultStructure(vaultPath) {
  for (const dir of VAULT_DIRS) {
    fs.mkdirSync(path.join(vaultPath, dir), { recursive: true });
  }
  fs.mkdirSync(path.join(vaultPath, ".obsidian", "plugins", "dataview"), { recursive: true });
  fs.mkdirSync(path.join(vaultPath, ".obsidian", "snippets"), { recursive: true });
  for (const { path: relPath, content } of VAULT_STUBS) {
    const fullPath = path.join(vaultPath, relPath);
    if (!fs.existsSync(fullPath)) {
      try {
        fs.writeFileSync(fullPath, content, "utf-8");
      } catch {
      }
    }
  }
}
let watcher = null;
const appWriteLocks = /* @__PURE__ */ new Set();
function startWatcher(vaultPath, win) {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  watcher = chokidar.watch(vaultPath, {
    // Allow .planner/ and .obsidian/ — ignore all other hidden paths
    ignored: (p) => {
      const rel = path.relative(vaultPath, p);
      if (rel === ".planner" || rel.startsWith(".planner/")) return false;
      if (rel === ".obsidian" || rel.startsWith(".obsidian/")) return false;
      return /(^|[/\\])\../.test(rel);
    },
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 }
  });
  const emit = (event, payload) => {
    if (!win.isDestroyed()) win.webContents.send(event, payload);
  };
  watcher.on("change", (filePath) => {
    if (appWriteLocks.has(filePath)) return;
    const rel = path.relative(vaultPath, filePath);
    if (!rel.endsWith(".md") && !rel.startsWith(".planner")) return;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      emit("vault:file-changed", { path: rel, content });
    } catch {
    }
  }).on("add", (filePath) => {
    const rel = path.relative(vaultPath, filePath);
    if (!rel.endsWith(".md")) return;
    if (appWriteLocks.has(filePath)) return;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      emit("vault:file-added", { path: rel, content });
    } catch {
    }
  }).on("unlink", (filePath) => {
    const rel = path.relative(vaultPath, filePath);
    emit("vault:file-removed", { path: rel });
  });
}
let currentVaultPath = null;
function registerVaultHandlers(win) {
  currentVaultPath = loadSavedVaultPath();
  if (currentVaultPath) startWatcher(currentVaultPath, win);
  electron.ipcMain.handle("vault:get", () => currentVaultPath);
  electron.ipcMain.handle("vault:select", async () => {
    const result = await electron.dialog.showOpenDialog(win, {
      title: "Selecionar Cofre (Vault)",
      properties: ["openDirectory", "createDirectory"],
      message: "Escolha um diretório para usar como cofre do Planner",
      buttonLabel: "Usar como Cofre"
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const vaultPath = result.filePaths[0];
    ensureVaultStructure(vaultPath);
    saveVaultPath(vaultPath);
    currentVaultPath = vaultPath;
    startWatcher(vaultPath, win);
    return vaultPath;
  });
  electron.ipcMain.on("vault:sync-flush", (event, entries) => {
    if (!currentVaultPath) {
      event.returnValue = false;
      return;
    }
    for (const { path: relPath, content } of entries) {
      try {
        const filePath = path.join(currentVaultPath, relPath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        appWriteLocks.add(filePath);
        fs.writeFileSync(filePath, content, "utf-8");
        setTimeout(() => appWriteLocks.delete(filePath), 600);
      } catch (e) {
        console.error("vault:sync-flush error:", e);
      }
    }
    event.returnValue = true;
  });
  electron.ipcMain.handle("vault:read-file", (_e, relativePath) => {
    if (!currentVaultPath) return null;
    const filePath = path.join(currentVaultPath, relativePath);
    try {
      if (fs.existsSync(filePath)) return fs.readFileSync(filePath, "utf-8");
    } catch {
    }
    return null;
  });
  electron.ipcMain.handle("vault:write-file", (_e, relativePath, content) => {
    if (!currentVaultPath) return false;
    const filePath = path.join(currentVaultPath, relativePath);
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      appWriteLocks.add(filePath);
      fs.writeFileSync(filePath, content, "utf-8");
      setTimeout(() => appWriteLocks.delete(filePath), 600);
      return true;
    } catch (e) {
      console.error("vault:write-file error:", e);
      return false;
    }
  });
  electron.ipcMain.handle("vault:delete-file", (_e, relativePath) => {
    if (!currentVaultPath) return false;
    const filePath = path.join(currentVaultPath, relativePath);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("vault:list-files", (_e, dir) => {
    if (!currentVaultPath) return [];
    const dirPath = path.join(currentVaultPath, dir);
    try {
      if (!fs.existsSync(dirPath)) return [];
      return fs.readdirSync(dirPath).filter((f) => f.endsWith(".md")).map((f) => {
        const fp = path.join(dirPath, f);
        return { name: f, path: `${dir}/${f}`, mtime: fs.statSync(fp).mtimeMs };
      });
    } catch {
      return [];
    }
  });
}
const isDev = process.env.NODE_ENV === "development";
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: "#F5F0E8",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  let closeAllowed = false;
  let flushFallbackTimer = null;
  mainWindow.on("close", (e) => {
    if (!closeAllowed) {
      e.preventDefault();
      flushFallbackTimer = setTimeout(() => {
        closeAllowed = true;
        mainWindow.close();
      }, 1200);
      mainWindow.webContents.send("app:request-flush");
    }
  });
  electron.ipcMain.once("app:flush-done", () => {
    if (flushFallbackTimer) {
      clearTimeout(flushFallbackTimer);
      flushFallbackTimer = null;
    }
    closeAllowed = true;
    mainWindow.close();
  });
  if (isDev) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  registerVaultHandlers(mainWindow);
  return mainWindow;
}
electron.ipcMain.handle("window-minimize", (e) => electron.BrowserWindow.fromWebContents(e.sender)?.minimize());
electron.ipcMain.handle("window-maximize", (e) => {
  const win = electron.BrowserWindow.fromWebContents(e.sender);
  win?.isMaximized() ? win.unmaximize() : win?.maximize();
});
electron.ipcMain.handle("window-close", (e) => electron.BrowserWindow.fromWebContents(e.sender)?.close());
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
