// ─── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 860,
    minWidth: 900,
    minHeight: 700,
    backgroundColor: "#0b1018",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0b1018",
      symbolColor: "#8494b2",
      height: 38,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    title: "WaveScript",
    icon: path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png"),
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Dev mode: Ctrl+R reloads the page, F12 opens DevTools
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === "r" && (input.control || input.meta)) {
      mainWindow.reload();
      event.preventDefault();
    }
  });

  // Right-click context menu
  mainWindow.webContents.on("context-menu", (e, params) => {
    const menu = Menu.buildFromTemplate([
      { role: "undo", label: "Undo", enabled: params.isEditable },
      { role: "redo", label: "Redo", enabled: params.isEditable },
      { type: "separator" },
      { role: "cut", label: "Cut", enabled: params.isEditable && !!params.selectionText },
      { role: "copy", label: "Copy", enabled: !!params.selectionText },
      { role: "paste", label: "Paste", enabled: params.isEditable },
      { type: "separator" },
      { role: "selectAll", label: "Select All" },
    ]);
    menu.popup();
  });
}

// Update titlebar overlay colors when theme changes
ipcMain.handle("set-titlebar-theme", (_, theme) => {
  if (!mainWindow) return;
  if (theme === "dark") {
    mainWindow.setTitleBarOverlay({ color: "#0b1018", symbolColor: "#8494b2" });
  } else {
    mainWindow.setTitleBarOverlay({ color: "#e0e4ea", symbolColor: "#4a5568" });
  }
});

app.whenReady().then(() => {
  if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
  if (!fs.existsSync(whisperBinDir)) fs.mkdirSync(whisperBinDir, { recursive: true });
  createWindow();
});

app.on("window-all-closed", () => app.quit());
