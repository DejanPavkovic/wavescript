const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const https = require("https");
const http = require("http");

// Set proper casing for the AppData folder (C:\Users\...\AppData\Roaming\WaveScript)
app.setName("WaveScript");

let mainWindow;
const userDataPath = app.getPath("userData");
const modelsDir = path.join(userDataPath, "whisper-models");
const whisperBinDir = path.join(userDataPath, "whisper-bin");
const settingsFile = path.join(userDataPath, "wavescript-settings.json");

// VAD (Voice Activity Detection) — Silero v5.1.2 model from whisper.cpp project.
// Pre-segments audio into speech regions before Whisper sees it. This prevents
// Large V3 from entering hallucination loops on long audio (>20 min) that
// previously produced negative timestamps. ~30 MB, downloaded once on first use.
const VAD_MODEL_URL = "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin";
const VAD_MODEL_FILE = "ggml-silero-v5.1.2.bin";
const vadDir = path.join(userDataPath, "vad");
const vadModelPath = path.join(vadDir, VAD_MODEL_FILE);

