// ─── IPC: Settings ──────────────────────────────────────────────────────────
ipcMain.handle("load-settings", () => loadSettings());
ipcMain.handle("save-settings", (_, data) => { saveSettings(data); return true; });

// ─── IPC: Setup Status ─────────────────────────────────────────────────────
ipcMain.handle("get-setup-status", () => {
  const settings = loadSettings();
  let downloadedModels = [];
  try {
    downloadedModels = fs.readdirSync(modelsDir)
      .filter(f => f.endsWith(".bin"))
      .filter(f => !f.startsWith("ggml-silero"));  // VAD model lives in vad/ folder, exclude if leftover
  } catch (e) {}

  const whisperPath = settings.whisperPath || findWhisperCli() || null;
  const modelPath = settings.modelPath || (downloadedModels.length > 0 ? path.join(modelsDir, downloadedModels[0]) : null);

  return {
    whisperReady: !!(whisperPath && fs.existsSync(whisperPath)),
    whisperPath: whisperPath,
    modelReady: !!(modelPath && fs.existsSync(modelPath)),
    modelPath: modelPath,
    downloadedModels: downloadedModels.map(f => ({
      name: f,
      path: path.join(modelsDir, f),
      size: fs.statSync(path.join(modelsDir, f)).size,
    })),
    deeplReady: !!settings.deeplApiKey,
    deeplApiKey: settings.deeplApiKey || null,
    modelsDir: modelsDir,
    whisperBinDir: whisperBinDir,
  };
});

// ─── IPC: Available Models ──────────────────────────────────────────────────
ipcMain.handle("get-available-models", () => [
  // tier: "fast" | "balanced" | "best" — qualityKey resolves to i18n in renderer
  { id: "tiny", name: "Tiny", file: "ggml-tiny.bin", size: "75 MB", sizeBytes: 77000000, qualityKey: "mdl_q_tiny", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin", lang: "multi", tier: "fast" },
  { id: "tiny.en", name: "Tiny.en", file: "ggml-tiny.en.bin", size: "75 MB", sizeBytes: 77000000, qualityKey: "mdl_q_tiny_en", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin", lang: "en", tier: "fast" },
  { id: "base", name: "Base", file: "ggml-base.bin", size: "142 MB", sizeBytes: 148000000, qualityKey: "mdl_q_base", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin", lang: "multi", tier: "fast" },
  { id: "base.en", name: "Base.en", file: "ggml-base.en.bin", size: "142 MB", sizeBytes: 148000000, qualityKey: "mdl_q_base_en", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin", lang: "en", tier: "fast" },
  { id: "small", name: "Small", file: "ggml-small.bin", size: "466 MB", sizeBytes: 488000000, qualityKey: "mdl_q_small", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin", lang: "multi", tier: "balanced" },
  { id: "small.en", name: "Small.en", file: "ggml-small.en.bin", size: "466 MB", sizeBytes: 488000000, qualityKey: "mdl_q_small_en", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin", lang: "en", tier: "balanced" },
  { id: "medium", name: "Medium", file: "ggml-medium.bin", size: "1.5 GB", sizeBytes: 1530000000, qualityKey: "mdl_q_medium", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin", lang: "multi", tier: "balanced" },
  { id: "medium.en", name: "Medium.en", file: "ggml-medium.en.bin", size: "1.5 GB", sizeBytes: 1530000000, qualityKey: "mdl_q_medium_en", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin", lang: "en", tier: "balanced" },
  { id: "large-v3-turbo", name: "Large V3 Turbo", file: "ggml-large-v3-turbo.bin", size: "1.6 GB", sizeBytes: 1620000000, qualityKey: "mdl_q_large_v3_turbo", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin", lang: "multi", tier: "best", recommended: true },
  { id: "large-v2", name: "Large V2", file: "ggml-large-v2.bin", size: "2.9 GB", sizeBytes: 2900000000, qualityKey: "mdl_q_large_v2", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin", lang: "multi", tier: "best" },
  { id: "large-v3", name: "Large V3", file: "ggml-large-v3.bin", size: "3.1 GB", sizeBytes: 3095000000, qualityKey: "mdl_q_large_v3", url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin", lang: "multi", tier: "best" },
]);

// ─── IPC: File Dialogs ──────────────────────────────────────────────────────
ipcMain.handle("select-file", async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: (options && options.filters) ? options.filters : [
      { name: "Audio/Video", extensions: ["mp3","wav","flac","ogg","m4a","wma","aac","mp4","mkv","avi","mov","webm","wmv"] },
      { name: "Subtitle Files", extensions: ["srt","vtt","txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

// Multi-file select for batch queue
ipcMain.handle("select-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Audio/Video", extensions: ["mp3","wav","flac","ogg","m4a","wma","aac","mp4","mkv","avi","mov","webm","wmv"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  return result.canceled ? [] : result.filePaths;
});

// Scan folder for audio/video files
ipcMain.handle("scan-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return [];
  const dir = result.filePaths[0];
  const audioExts = [".mp3",".wav",".flac",".ogg",".m4a",".wma",".aac",".mp4",".mkv",".avi",".mov",".webm",".wmv"];
  try {
    return fs.readdirSync(dir)
      .filter(f => audioExts.includes(path.extname(f).toLowerCase()))
      .map(f => path.join(dir, f));
  } catch (e) { return []; }
});

ipcMain.handle("select-executable", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "Executable", extensions: ["exe",""] }, { name: "All Files", extensions: ["*"] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});

