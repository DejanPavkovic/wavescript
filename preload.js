const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
  getSetupStatus: () => ipcRenderer.invoke("get-setup-status"),
  getAvailableModels: () => ipcRenderer.invoke("get-available-models"),
  selectFile: (o) => ipcRenderer.invoke("select-file", o),
  selectFiles: () => ipcRenderer.invoke("select-files"),
  scanFolder: () => ipcRenderer.invoke("scan-folder"),
  selectExecutable: () => ipcRenderer.invoke("select-executable"),
  selectDirectory: () => ipcRenderer.invoke("select-directory"),

  downloadWhisper: (o) => ipcRenderer.invoke("download-whisper", o),
  downloadModel: (o) => ipcRenderer.invoke("download-model", o),
  cancelDownload: () => ipcRenderer.invoke("cancel-download"),
  deleteModel: (p) => ipcRenderer.invoke("delete-model", p),

  onWhisperDownloadProgress: (cb) => { const fn = (_, d) => cb(d); ipcRenderer.on("whisper-download-progress", fn); return () => ipcRenderer.removeListener("whisper-download-progress", fn); },
  onDownloadProgress: (cb) => { const fn = (_, d) => cb(d); ipcRenderer.on("download-progress", fn); return () => ipcRenderer.removeListener("download-progress", fn); },

  transcribe: (o) => ipcRenderer.invoke("transcribe", o),
  cancelTranscribe: () => ipcRenderer.invoke("cancel-transcribe"),
  onTranscribeProgress: (cb) => { const fn = (_, d) => cb(d); ipcRenderer.on("transcribe-progress", fn); return () => ipcRenderer.removeListener("transcribe-progress", fn); },

  translate: (o) => ipcRenderer.invoke("translate", o),
  onTranslateProgress: (cb) => { const fn = (_, d) => cb(d); ipcRenderer.on("translate-progress", fn); return () => ipcRenderer.removeListener("translate-progress", fn); },

  openFolder: (p) => ipcRenderer.invoke("open-folder", p),
  openUrl: (u) => ipcRenderer.invoke("open-url", u),
  getFilePathFromDrop: (file) => {
    try { const { webUtils } = require("electron"); return webUtils.getPathForFile(file); } catch(e) { return file.path || ""; }
  },
  setTitlebarTheme: (t) => ipcRenderer.invoke("set-titlebar-theme", t),
  readFile: (p) => ipcRenderer.invoke("read-file", p),
  deeplUsage: (k) => ipcRenderer.invoke("deepl-usage", k),
  getAudioDuration: (p) => ipcRenderer.invoke("get-audio-duration", p),
});
